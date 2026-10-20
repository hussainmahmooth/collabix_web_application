'use server'

import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'

function getMockAIResponse(question: string, context: any) {
  const q = question.toLowerCase()
  const overdueTasks = context.tasks.filter((t: any) => {
    if (!t.due_date || t.status === 'COMPLETED') return false
    return new Date(t.due_date) < new Date()
  })

  let answer = `**[Collabix AI Sandbox Mode]** *(Set \`GEMINI_API_KEY\` in your \`.env.local\` file to connect to live Google Gemini models)*\n\n`
  
  if (q.includes('overdue')) {
    if (overdueTasks.length === 0) {
      answer += "Great news! There are currently no overdue tasks in this workspace."
    } else {
      answer += `You currently have **${overdueTasks.length}** overdue items that need attention:\n\n`
      overdueTasks.forEach((t: any) => {
        answer += `- **${t.title}** (Project: *${t.project}*, Assigned to: *${t.assignee}*, Due: *${new Date(t.due_date).toLocaleDateString()}*)\n`
      })
      answer += "\nI recommend assigning these to team members or updating deadlines to keep sprints on track."
    }
  } else if (q.includes('workload') || q.includes('assigned') || q.includes('who has')) {
    const workloadMap: Record<string, number> = {}
    context.tasks.forEach((t: any) => {
      if (t.status !== 'COMPLETED') {
        workloadMap[t.assignee] = (workloadMap[t.assignee] || 0) + 1
      }
    })
    
    answer += "Here is the active task distribution across your team:\n\n"
    const entries = Object.entries(workloadMap)
    if (entries.length === 0) {
      answer += "No active tasks are currently assigned to any team members."
    } else {
      entries.forEach(([name, count]) => {
        answer += `- **${name}**: ${count} active tasks\n`
      })
    }
  } else if (q.includes('progress') || q.includes('project') || q.includes('schedule') || q.includes('summarize')) {
    answer += "Current progress status for workspace projects:\n\n"
    if (context.projects.length === 0) {
      answer += "No projects created yet in this workspace."
    } else {
      context.projects.forEach((p: any) => {
        answer += `- **${p.name}** is **${p.progress}%** complete (Status: *${p.status}*)\n`
      })
    }
  } else if (q.includes('today') || q.includes('work on')) {
    const myPendingTasks = context.tasks.filter((t: any) => 
      t.status !== 'COMPLETED' && 
      t.assignee !== 'Unassigned'
    )
    
    if (myPendingTasks.length === 0) {
      answer += "You have no active tasks assigned to you. Consider looking at the backlog to pick up unassigned items!"
    } else {
      answer += "Here are the tasks you should focus on today:\n\n"
      myPendingTasks.forEach((t: any) => {
        answer += `- **${t.title}** (Project: *${t.project}*, Priority: *${t.priority}*)\n`
      })
    }
  } else {
    answer += `Based on your Collabix workspace context, you have **${context.projects.length}** projects, **${context.tasks.length}** total tasks, and **${context.members.length}** team members.

You can ask me questions such as:
- *"What tasks are overdue?"*
- *"Who has the highest workload?"*
- *"What should I work on today?"*
- *"Summarize the project statuses."*`
  }

  return answer
}

export async function askAI(question: string, workspaceId: string) {
  const supabase = await createClient()

  // 1. Authenticate session
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // 2. Fetch projects matching workspace
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('workspace_id', workspaceId)

  // 3. Fetch tasks matching projects
  const projectIds = projects?.map((p: any) => p.id) || []
  let tasks: any[] = []

  if (projectIds.length > 0) {
    const { data } = await supabase
      .from('tasks')
      .select(`
        *,
        projects(name),
        task_assignees(
          profiles(full_name)
        )
      `)
      .in('project_id', projectIds)
    tasks = data || []
  }

  // 4. Fetch members matching workspace
  const { data: members } = await supabase
    .from('workspace_members')
    .select('*, profiles(full_name)')
    .eq('workspace_id', workspaceId)

  // 5. Serialize workspace context
  const context = {
    projects: projects?.map((p: any) => ({
      name: p.name,
      description: p.description,
      status: p.status,
      progress: p.progress,
      due_date: p.due_date
    })) || [],
    tasks: tasks.map(t => ({
      title: t.title,
      project: t.projects?.name || 'Unknown Project',
      status: t.status,
      priority: t.priority,
      due_date: t.due_date,
      assignee: t.task_assignees?.map((a: any) => a.profiles?.full_name).join(', ') || 'Unassigned'
    })),
    members: members?.map((m: any) => ({
      name: m.profiles?.full_name || 'Unknown User',
      role: m.role
    })) || []
  }

  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    return getMockAIResponse(question, context)
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `
You are Collabix AI, a helpful, precise project management assistant for the Collabix Team Workspace.
You have access to the user's actual project and task database context listed below.
Answer their questions based on the database context provided. If they ask about overdue tasks, workload, or milestones, cite the database numbers exactly. Write responses in clean markdown. Do not hallucinate or mock any data outside of what is provided in the Context below.

Context:
${JSON.stringify(context, null, 2)}

User Question:
"${question}"
`
    const result = await model.generateContent(prompt)
    return result.response.text()
  } catch (err: any) {
    console.error('Gemini API error:', err)
    return `Error generating response from Google Gemini: ${err.message}`
  }
}
