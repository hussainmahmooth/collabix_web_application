import { test, expect } from '@playwright/test'

// Isolated UI contract fixtures; production always uses Supabase. Live RLS tests are in SQL.
test('workspace navigation, task creation and branding on desktop and mobile', async ({ page }) => {
 const userId='11111111-1111-4111-8111-111111111111', workspaceId='22222222-2222-4222-8222-222222222222'
 let workspace={id:workspaceId,name:'Applied Intelligence Lab',research_title:'Forecasting for better retail decisions',institution:'Research University',department:'Computing',programme:'Applied research',supervisor_details:'',description:'Exploring practical forecasting with a shared research plan.',logo_path:null,accent_color:'#168e88',start_date:null,deadline:'2027-02-15',created_by:userId}
 const member={user_id:userId,role:'leader',responsibilities:'',rf_profiles:{full_name:'Test Researcher',skills:'Machine learning'}}
 const phase={id:'33333333-3333-4333-8333-333333333333',workspace_id:workspaceId,name:'Literature Review',description:'Build a grounded understanding of existing work.',objectives:'Compare reproducible forecasting approaches.',start_date:null,deadline:'2026-11-15',owner_id:userId,position:0,status:'In Progress',review_state:'Not requested'}
 const tasks: Record<string, unknown>[]=[]
 await page.addInitScript(({userId})=>{const project='mephxqyntqqoxfnygavy';localStorage.setItem(`sb-${project}-auth-token`,JSON.stringify({access_token:'test.ui.contract',refresh_token:'test-refresh',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:userId,email:'ui-test@example.invalid',aud:'authenticated',role:'authenticated',user_metadata:{full_name:'Test Researcher'}}}))},{userId})
 await page.route('https://*.supabase.co/**',async route=>{
  const req=route.request();const path=new URL(req.url()).pathname;const method=req.method();let result:unknown=[]
  if(path.includes('/rf_workspaces')){if(method==='PATCH')workspace={...workspace,...req.postDataJSON()};result=[workspace]}
  else if(path.includes('/rf_workspace_members'))result=[member]
  else if(path.includes('/rf_research_phases'))result=[phase]
  else if(path.includes('/rf_tasks')){if(method==='POST')tasks.unshift({...req.postDataJSON(),id:'44444444-4444-4444-8444-444444444444',status:'To Do',archived:false,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});if(method==='PATCH')Object.assign(tasks[0],req.postDataJSON());result=tasks}
  else if(path.includes('/auth/v1/user'))result={id:userId,email:'ui-test@example.invalid'}
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)})
 })
 await page.goto('/dashboard');await expect(page.getByRole('heading',{name:'Let’s make progress, Test.'})).toBeVisible();await expect(page.getByRole('heading',{name:workspace.research_title})).toBeVisible()
 await page.screenshot({path:`test-results/dashboard-${test.info().project.name}.png`,fullPage:true})
 await page.getByRole('button',{name:'Create task',exact:true}).click();await page.getByLabel('Task title').fill('Compare forecasting baselines');await page.getByRole('combobox',{name:'Assignee',exact:true}).selectOption(userId);await page.getByRole('button',{name:'Create task',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0)
 const mobile=test.info().project.name==='mobile';await page.getByRole('link',{name:/^Tasks/}).last().click();await expect(page.getByRole('heading',{name:'Compare forecasting baselines'})).toBeVisible()
 await page.getByLabel('Status for Compare forecasting baselines').selectOption('In Progress');await expect(page.getByLabel('Status for Compare forecasting baselines')).toHaveValue('In Progress')
 await page.screenshot({path:`test-results/tasks-${test.info().project.name}.png`,fullPage:true})
 if(mobile)await page.getByRole('button',{name:'Open navigation'}).click();await page.getByRole('link',{name:'Settings',exact:true}).click();await page.getByLabel('Team name',{exact:true}).fill('A renamed research team');await page.getByRole('button',{name:'Save workspace settings'}).click();await expect(page.getByRole('status')).toContainText('Workspace settings saved')
 expect(workspace.name).toBe('A renamed research team');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
})


