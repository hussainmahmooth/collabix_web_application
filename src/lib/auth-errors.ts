export function authFailure(error: unknown) {
 const details = typeof error === 'object' && error !== null ? error as {code?:string;status?:number;message?:string} : {};
 const emailRateLimited = details.code === 'over_email_send_rate_limit' || /email.*rate.*limit/i.test(details.message || '');
 if (emailRateLimited) return { emailRateLimited, message: 'Email delivery is temporarily rate limited. Wait before trying again. If this continues, ask your team leader to check the email service. This does not mean your workspace is full.' };
 return { emailRateLimited: false, message: details.message || (error instanceof Error ? error.message : 'Unable to authenticate. Please try again.') };
}
