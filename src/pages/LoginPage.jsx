import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useClinicSettings } from '../context/ClinicSettingsContext.jsx';
import './LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { settings } = useClinicSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isPosLoginDomain =
    typeof window !== 'undefined' && /(^|\.)demo\./i.test(window.location.hostname || '');

  const heroDescription = isPosLoginDomain
    ? settings?.pos_description || settings?.description
    : settings?.description;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      navigate('/');
    } else {
      setError(result.message || 'Invalid credentials');
    }
  };

  return (
    <>
  <main className="login-container">
        {/* Left Side - Hero Image */}
        <div className="hero-section">
          <img
            src={settings?.hero_image_url || './vet-clinic-hero.jpg'}
            alt="Veterinary clinic"
            className="hero-image"
          />
          <div className="hero-overlay" />
          <div className="hero-content">
            <h1 className="hero-title">Welcome to {settings?.name}</h1>
            <p className="hero-text">
              {heroDescription}
            </p>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="form-section">
          <div className="form-card">
            {/* Logo/Header */}
            <div className="form-header">
              <div className="logo-icon">
                <img src={settings?.logo_url} alt={`${settings?.name} logo`} className="logo-image" />
              </div>
              <h2 className="clinic-name">{settings?.name}</h2>
              <p className="clinic-subtitle">{settings?.pos_description || 'Veterinary Management System'}</p>
            </div>
 {error && <div className="alert alert-error mb-4">{error}</div>}
            {/* Login Form */}
            <form onSubmit={handleSubmit}>
              {/* Email Field */}
              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="form-input"
                />
              </div>

              {/* Password Field */}
              <div className="form-group">
                <div className="label-row">
                  <label htmlFor="password" className="form-label">
                    Password
                  </label>
                  {/* <a href="#" className="forgot-link">
                    Forgot password?
                  </a> */}
                </div>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="form-input"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="submit-button"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            {/* Divider */}
            <div className="divider">
              <div className="divider-line" />
              <span className="divider-text">or</span>
              <div className="divider-line" />
            </div>

            {/* Additional Login Option */}
            <button className="google-button" disabled>
              <svg
                className="google-icon"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            {/* Footer */}
            {/* <p className="form-footer">
              Don't have an account?{' '}
              <a href="#" className="signup-link">
                Request access
              </a>
            </p> */}
          </div>
        </div>
      </main>
    </>
  );
}
