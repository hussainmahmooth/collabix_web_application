import { describe, expect, it } from 'vitest';
import { authFailure } from './auth-errors';
describe('authentication email failures',()=>{
 it('explains the provider email limit separately from workspace capacity',()=>{const result=authFailure({code:'over_email_send_rate_limit',status:429,message:'email rate limit exceeded'});expect(result.emailRateLimited).toBe(true);expect(result.message).toContain('does not mean your workspace is full')});
 it('recognizes older servers that only return the message',()=>expect(authFailure(new Error('email rate limit exceeded')).emailRateLimited).toBe(true));
 it('preserves other authentication errors',()=>expect(authFailure({message:'Invalid login credentials'}).message).toBe('Invalid login credentials'));
});
