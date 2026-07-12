import Link from 'next/link'
import { signup } from '../auth/actions'

export default function SignupPage() {
  return (
    <main className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Create an Account</h1>
          <p>Start tracking your accomplishments today.</p>
        </div>
        
        <form className="auth-form" action={signup}>
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input 
              id="name" 
              name="name" 
              type="text" 
              placeholder="Jane Doe" 
              required 
            />
          </div>

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
            Create Account
          </button>
        </form>
        
        <div className="auth-footer">
          Already have an account? <Link href="/login">Sign in</Link>
        </div>
      </div>
    </main>
  )
}
