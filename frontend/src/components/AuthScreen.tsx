import React, { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Brain, Lock, Mail, User, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

interface AuthScreenProps {
  onLogin: (email: string, pass: string) => Promise<void>;
  onRegister: (email: string, name: string, pass: string) => Promise<void>;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin, onRegister }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await onLogin(email, password);
    } catch (err: any) {
      setError(err.message || "Login failed. Please check your credentials.");
      console.error("Login failed", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await onRegister(email, name, password);
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
      console.error("Registration failed", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 p-6 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/5 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.05)_0%,transparent_70%)]" />
      </div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-[420px] relative z-10"
      >
        {/* Branding */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center shadow-2xl mb-6">
            <Brain className="w-8 h-8 text-blue-500" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic">Flamenco</h1>
          <div className="flex items-center gap-3 mt-3">
            <div className="h-px w-6 bg-zinc-800" />
            <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-[0.3em]">Neural Trading OS</p>
            <div className="h-px w-6 bg-zinc-800" />
          </div>
        </div>

        <Tabs defaultValue="login" className="w-full" onValueChange={() => setError(null)}>
          <div className="bg-zinc-900/50 border border-zinc-800/50 p-1 rounded-xl mb-6 backdrop-blur-md">
            <TabsList className="grid w-full grid-cols-2 bg-transparent h-10">
              <TabsTrigger 
                value="login" 
                className="rounded-lg text-[10px] font-bold uppercase tracking-wider data-[state=active]:bg-zinc-800 data-[state=active]:text-white transition-all"
              >
                Session Start
              </TabsTrigger>
              <TabsTrigger 
                value="register" 
                className="rounded-lg text-[10px] font-bold uppercase tracking-wider data-[state=active]:bg-zinc-800 data-[state=active]:text-white transition-all"
              >
                Network Join
              </TabsTrigger>
            </TabsList>
          </div>

          <AnimatePresence mode="wait">
            <TabsContent value="login" className="mt-0">
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="bg-zinc-900/40 border-zinc-800/60 shadow-2xl backdrop-blur-xl rounded-3xl overflow-hidden">
                  <CardHeader className="space-y-1 pb-6 pt-8 px-8">
                    <CardTitle className="text-xl font-bold text-white">Authentication Required</CardTitle>
                    <CardDescription className="text-zinc-500 text-xs">Initialize your secure trading session.</CardDescription>
                  </CardHeader>
                  <form onSubmit={handleLogin}>
                    <CardContent className="space-y-5 px-8 pb-4">
                      {error && (
                        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold uppercase tracking-wide">
                          {error}
                        </div>
                      )}
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Terminal ID (Email)</label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                          <Input 
                            type="email" 
                            placeholder="operator@flamenco.io" 
                            className="h-12 pl-11 bg-zinc-950/50 border-zinc-800 text-white rounded-xl focus-visible:ring-blue-500/20 focus-visible:border-blue-500/50 transition-all placeholder:text-zinc-700"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center ml-1">
                          <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Access Key</label>
                          <button type="button" className="text-[9px] font-bold text-blue-500 uppercase tracking-widest hover:text-blue-400">Lost Key?</button>
                        </div>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                          <Input 
                            type="password" 
                            placeholder="••••••••••••" 
                            className="h-12 pl-11 bg-zinc-950/50 border-zinc-800 text-white rounded-xl focus-visible:ring-blue-500/20 focus-visible:border-blue-500/50 transition-all placeholder:text-zinc-700"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="px-8 pb-10 pt-4">
                      <Button 
                        type="submit" 
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase tracking-widest text-[11px] h-12 rounded-xl shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50" 
                        disabled={isLoading}
                      >
                        {isLoading ? "Verifying..." : "Initialize Session"}
                      </Button>
                    </CardFooter>
                  </form>
                </Card>
              </motion.div>
            </TabsContent>

            <TabsContent value="register" className="mt-0">
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="bg-zinc-900/40 border-zinc-800/60 shadow-2xl backdrop-blur-xl rounded-3xl overflow-hidden">
                  <CardHeader className="space-y-1 pb-6 pt-8 px-8">
                    <CardTitle className="text-xl font-bold text-white">Network Registration</CardTitle>
                    <CardDescription className="text-zinc-500 text-xs">Apply for institutional terminal access.</CardDescription>
                  </CardHeader>
                  <form onSubmit={handleRegister}>
                    <CardContent className="space-y-4 px-8 pb-4">
                      {error && (
                        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold uppercase tracking-wide">
                          {error}
                        </div>
                      )}
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Operator Name</label>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                          <Input 
                            type="text" 
                            placeholder="John Doe" 
                            className="h-12 pl-11 bg-zinc-950/50 border-zinc-800 text-white rounded-xl focus-visible:ring-blue-500/20 focus-visible:border-blue-500/50 transition-all placeholder:text-zinc-700 font-medium"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Network Email</label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                          <Input 
                            type="email" 
                            placeholder="operator@flamenco.io" 
                            className="h-12 pl-11 bg-zinc-950/50 border-zinc-800 text-white rounded-xl focus-visible:ring-blue-500/20 focus-visible:border-blue-500/50 transition-all placeholder:text-zinc-700 font-medium"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Secure Password</label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                          <Input 
                            type="password" 
                            placeholder="••••••••••••" 
                            className="h-12 pl-11 bg-zinc-950/50 border-zinc-800 text-white rounded-xl focus-visible:ring-blue-500/20 focus-visible:border-blue-500/50 transition-all placeholder:text-zinc-700"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="px-8 pb-10 pt-4">
                      <Button 
                        type="submit" 
                        className="w-full bg-zinc-100 hover:bg-white text-zinc-950 font-bold uppercase tracking-widest text-[11px] h-12 rounded-xl shadow-lg shadow-white/5 transition-all disabled:opacity-50" 
                        disabled={isLoading}
                      >
                        {isLoading ? "Processing..." : "Create Identity"}
                      </Button>
                    </CardFooter>
                  </form>
                </Card>
              </motion.div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>

        {/* Security Footer */}
        <div className="mt-10 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2.5 px-4 py-2 bg-zinc-900/40 border border-zinc-800/50 rounded-full backdrop-blur-md">
            <div className="w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            <p className="text-[8px] text-zinc-500 font-mono uppercase tracking-[0.2em]">AES-256 End-to-End Encryption Active</p>
          </div>
          <p className="text-[8px] text-zinc-700 font-mono uppercase tracking-[0.4em]">
            Demo: demo@example.com / password
          </p>
        </div>
      </motion.div>
    </div>
  );
};
