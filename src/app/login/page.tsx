import Link from 'next/link'
import { login } from '../auth/actions'

export default function LoginPage() {
  return (
    <main className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Welcome Back</h1>
          <p>Sign in to your Tracck account to continue.</p>
        </div>
        
        <form className="auth-form" action={login}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input 
              id="email" 
              name="email" 
              type="email" 
              placeholder="you@example.com" 
              required 
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input 
              id="password" 
              name="password" 
              type="password" 
              placeholder="••••••••" 
              required 
            />
          </div>
          
          <button type="submit" className="auth-button">
            Sign In
          </button>
        </form>
        
        <div className="auth-footer">
          Don't have an account? <Link href="/signup">Sign up</Link>
        </div>
      </div>
    </main>
  )
}
