import { test,expect } from '@playwright/test'
test('registration, login and reset screens stay usable at every size',async({page})=>{
 await page.goto('/');await expect(page.getByRole('heading',{name:'Welcome back.'})).toBeVisible();await expect(page.getByText('Micro Biz Tek')).toBeVisible()
 await page.getByRole('link',{name:'Create an account'}).click();await expect(page.getByLabel('Full name')).toBeVisible();await expect(page.getByRole('heading',{name:'Start something meaningful.'})).toBeVisible()
 await page.getByRole('link',{name:'Sign in',exact:true}).click();await page.getByRole('link',{name:'Forgot password?'}).click();await expect(page.getByRole('button',{name:'Send reset link'})).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
})
test('password validation rejects short passwords',async({page})=>{
 await page.goto('/login');await page.getByLabel('Email address').fill('researcher@example.com');await page.getByLabel('Password',{exact:true}).fill('short');await page.getByRole('button',{name:'Sign in to your workspace'}).click();await expect(page.getByText('Use at least 8 characters')).toBeVisible()
})
