import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Eye, EyeOff } from 'lucide-react';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('signin');
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, signUp, user } = useAuth();

  // No need to handle navigation here - the parent App component handles it

  // Reset form when switching tabs
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setEmail('');
    setPassword('');
    setNickname('');
    setLoading(false);
    setShowPassword(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await signIn(email, password);
    
    if (error) {
      toast({
        title: "Error signing in",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success!",
        description: "Successfully signed in!",
        variant: "default",
      });
      // Clear form after successful sign in
      setEmail('');
      setPassword('');
    }
    
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await signUp(email, password, nickname);
    
    if (error) {
      toast({
        title: "Sign Up Error",
        description: error.message,
        variant: "destructive",
      });
      // If user is already registered, suggest switching to sign in
      if (error.message.includes('already registered')) {
        setTimeout(() => {
          setActiveTab('signin');
        }, 2000);
      }
      // Don't clear form on error so user can try again
    } else {
      toast({
        title: "Success!",
        description: "Account created successfully! Please check your email for verification.",
        variant: "default",
      });
      // Clear form after successful signup
      setEmail('');
      setPassword('');
      setNickname('');
      // Switch to sign in form
      setActiveTab('signin');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md card-enhanced">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gold">
            {activeTab === 'signin' ? 'Claim Manager - Sign In' : 'Claim Manager - Sign Up'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center mb-6">
            <div className="text-sm">
              {activeTab === 'signin' ? (
                <span className="text-gold-light">
                  Don't have an account?{' '}
                  <button
                    onClick={() => handleTabChange('signup')}
                    className="text-yellow-400 hover:text-yellow-300 underline"
                  >
                    Sign up here
                  </button>
                </span>
              ) : (
                <span className="text-gold-light">
                  Already have an account?{' '}
                  <button
                    onClick={() => handleTabChange('signin')}
                    className="text-yellow-400 hover:text-yellow-300 underline"
                  >
                    Sign in here
                  </button>
                </span>
              )}
            </div>
          </div>

          {activeTab === 'signin' ? (
            <form onSubmit={handleSignIn} className="space-y-4 auth-form">
                <div className="space-y-2">
                  <Label htmlFor="signin-email" className="text-gold-light">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-blue-900/30 border-yellow-400 text-white placeholder-gray-300"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password" className="text-gold-light">Password</Label>
                  <div className="relative">
                    <Input
                      id="signin-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="bg-blue-900/30 border-yellow-400 text-white placeholder-gray-300 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-yellow-400 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <button 
                  type="submit" 
                  className="w-full px-4 py-2 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed" 
                  style={{
                    backgroundColor: 'rgba(30, 58, 138, 0.3)',
                    border: '2px solid #10b981',
                    color: '#10b981',
                    background: 'rgba(30, 58, 138, 0.3)'
                  }}
                  disabled={loading}
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-4 auth-form">
                <div className="space-y-2">
                  <Label htmlFor="signup-name" className="text-gold-light">Nickname</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Enter your nickname"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    required
                    className="bg-blue-900/30 border-yellow-400 text-white placeholder-gray-300"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-gold-light">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-blue-900/30 border-yellow-400 text-white placeholder-gray-300"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-gold-light">Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="bg-blue-900/30 border-yellow-400 text-white placeholder-gray-300 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-yellow-400 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <button 
                  type="submit" 
                  className="w-full px-4 py-2 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed" 
                  style={{
                    backgroundColor: 'rgba(30, 58, 138, 0.3)',
                    border: '2px solid #10b981',
                    color: '#10b981'
                  }}
                  disabled={loading}
                >
                  {loading ? 'Creating account...' : 'Sign Up'}
                </button>
              </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;