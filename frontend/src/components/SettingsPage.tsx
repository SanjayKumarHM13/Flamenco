import React from "react";
import { motion } from "motion/react";
import { 
  Settings, 
  User, 
  Shield, 
  Bell, 
  Database, 
  Cpu, 
  Globe, 
  Lock,
  ChevronRight,
  Save
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { cn } from "../lib/utils";

interface SettingsSectionProps {
  title: string;
  description: string;
  icon: React.ElementType;
  children: React.ReactNode;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({ title, description, icon: Icon, children }) => (
  <section className="mb-12">
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center">
        <Icon className="w-5 h-5 text-blue-400" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <p className="text-sm text-zinc-500">{description}</p>
      </div>
    </div>
    <div className="space-y-4">
      {children}
    </div>
  </section>
);

export const SettingsPage: React.FC = () => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto py-12 px-6"
    >
      <div className="flex justify-between items-end mb-12">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic mb-2">System Configuration</h1>
          <p className="text-zinc-500 font-mono text-sm uppercase tracking-widest">Flamenco Terminal v4.2.0-stable</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-500 text-white gap-2 px-6 rounded-xl shadow-lg shadow-blue-600/20">
          <Save className="w-4 h-4" />
          Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <SettingsSection 
          title="Profile & Identity" 
          description="Manage your terminal identity and authentication credentials."
          icon={User}
        >
          <Card className="bg-zinc-900/50 border-zinc-800 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Display Name</label>
                <Input className="bg-zinc-950 border-zinc-800 text-white" defaultValue="Senior Quant Trader" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">API Access Key</label>
                <Input className="bg-zinc-950 border-zinc-800 text-white font-mono" type="password" defaultValue="••••••••••••••••" />
              </div>
            </div>
          </Card>
        </SettingsSection>

        <SettingsSection 
          title="Execution Engine" 
          description="Configure high-frequency execution parameters and risk limits."
          icon={Cpu}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-zinc-900/50 border-zinc-800 p-6 hover:border-blue-500/30 transition-colors cursor-pointer group">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-white mb-1">Latency Optimization</h3>
                  <p className="text-xs text-zinc-500">Enable direct memory access for MPI nodes.</p>
                </div>
                <div className="w-8 h-4 bg-blue-600 rounded-full relative">
                  <div className="absolute right-1 top-1 w-2 h-2 bg-white rounded-full" />
                </div>
              </div>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800 p-6 hover:border-blue-500/30 transition-colors cursor-pointer group">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-white mb-1">Circuit Breaker</h3>
                  <p className="text-xs text-zinc-500">Auto-halt trading on 2.5% portfolio drawdown.</p>
                </div>
                <div className="w-8 h-4 bg-blue-600 rounded-full relative">
                  <div className="absolute right-1 top-1 w-2 h-2 bg-white rounded-full" />
                </div>
              </div>
            </Card>
          </div>
        </SettingsSection>

        <SettingsSection 
          title="Security & Compliance" 
          description="Hardware security module and encryption settings."
          icon={Shield}
        >
          <Card className="bg-zinc-900/50 border-zinc-800 divide-y divide-zinc-800">
            {[
              { label: "Two-Factor Authentication", status: "Enabled", icon: Lock },
              { label: "Hardware Key (YubiKey)", status: "Not Detected", icon: Database },
              { label: "IP Whitelisting", status: "3 Addresses Active", icon: Globe },
            ].map((item, i) => (
              <div key={i} className="p-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <item.icon className="w-4 h-4 text-zinc-500" />
                  <span className="text-sm text-zinc-300 font-medium">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-zinc-500">{item.status}</span>
                  <ChevronRight className="w-4 h-4 text-zinc-700" />
                </div>
              </div>
            ))}
          </Card>
        </SettingsSection>

        <SettingsSection 
          title="Notifications" 
          description="Alert routing for critical system events and trade fills."
          icon={Bell}
        >
          <Card className="bg-zinc-900/50 border-zinc-800 p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-300">Push Notifications</span>
                <div className="w-8 h-4 bg-zinc-800 rounded-full relative">
                  <div className="absolute left-1 top-1 w-2 h-2 bg-zinc-500 rounded-full" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-300">Email Trade Reports</span>
                <div className="w-8 h-4 bg-blue-600 rounded-full relative">
                  <div className="absolute right-1 top-1 w-2 h-2 bg-white rounded-full" />
                </div>
              </div>
            </div>
          </Card>
        </SettingsSection>
      </div>
    </motion.div>
  );
};
