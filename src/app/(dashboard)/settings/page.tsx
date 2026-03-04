"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, User, Building2, Beaker, Globe, Bell, Save } from "lucide-react";
import { useUser } from "@/hooks/use-user";

export default function SettingsPage() {
  const { profile, organization } = useUser();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#1A4F6E] to-[#2D6A8A] text-white">
          <Settings className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your profile, organization, and engineering preferences</p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-[500px]">
          <TabsTrigger value="profile"><User className="mr-1.5 h-3.5 w-3.5" /> Profile</TabsTrigger>
          <TabsTrigger value="organization"><Building2 className="mr-1.5 h-3.5 w-3.5" /> Organization</TabsTrigger>
          <TabsTrigger value="engineering"><Beaker className="mr-1.5 h-3.5 w-3.5" /> Engineering</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="mr-1.5 h-3.5 w-3.5" /> Notifications</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Personal Information</CardTitle>
                <CardDescription>Your account details and display preferences</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Full Name</Label>
                  <Input defaultValue={profile?.full_name ?? "Demo Admin"} />
                </div>
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input defaultValue="admin@bosal-demo.com" disabled />
                  <p className="text-xs text-muted-foreground">Email cannot be changed. Contact support for assistance.</p>
                </div>
                <div className="grid gap-2">
                  <Label>Job Title</Label>
                  <Input defaultValue="Senior Catalyst Engineer" />
                </div>
                <div className="grid gap-2">
                  <Label>Department</Label>
                  <Select defaultValue="engineering">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="engineering">Engineering</SelectItem>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="operations">Operations</SelectItem>
                      <SelectItem value="management">Management</SelectItem>
                      <SelectItem value="rd">R&D</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleSave} className="w-fit">
                  <Save className="mr-2 h-4 w-4" />
                  {saved ? "Saved!" : "Save Changes"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Display Preferences</CardTitle>
                <CardDescription>Customize how data is displayed</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Language</Label>
                  <Select defaultValue="en">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="nl">Nederlands</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Date Format</Label>
                  <Select defaultValue="iso">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="iso">YYYY-MM-DD (ISO)</SelectItem>
                      <SelectItem value="eu">DD/MM/YYYY</SelectItem>
                      <SelectItem value="us">MM/DD/YYYY</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Number Format</Label>
                  <Select defaultValue="eu">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eu">1.234,56 (EU)</SelectItem>
                      <SelectItem value="us">1,234.56 (US)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Organization Tab */}
        <TabsContent value="organization" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Organization Details</CardTitle>
                <CardDescription>Company information and branding</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Organization Name</Label>
                  <Input defaultValue={organization?.name ?? "Bosal Emission Control Technologies"} />
                </div>
                <div className="grid gap-2">
                  <Label>Industry</Label>
                  <Select defaultValue="automotive">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="automotive">Automotive Aftermarket</SelectItem>
                      <SelectItem value="oem">OEM Manufacturer</SelectItem>
                      <SelectItem value="energy">Energy / Power Generation</SelectItem>
                      <SelectItem value="marine">Marine</SelectItem>
                      <SelectItem value="consulting">Engineering Consulting</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Country</Label>
                  <Select defaultValue="be">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="be">Belgium</SelectItem>
                      <SelectItem value="de">Germany</SelectItem>
                      <SelectItem value="nl">Netherlands</SelectItem>
                      <SelectItem value="fr">France</SelectItem>
                      <SelectItem value="gb">United Kingdom</SelectItem>
                      <SelectItem value="us">United States</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Website</Label>
                  <Input defaultValue="https://www.bosal.com" />
                </div>
                <Button onClick={handleSave} className="w-fit">
                  <Save className="mr-2 h-4 w-4" />
                  {saved ? "Saved!" : "Save Changes"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Team Members</CardTitle>
                <CardDescription>Users in your organization</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: "Demo Admin", role: "Admin", email: "admin@bosal-demo.com", active: true },
                    { name: "Jan De Smet", role: "Engineer", email: "jan.desmet@bosal.com", active: true },
                    { name: "Marie Dupont", role: "Sales", email: "marie.dupont@bosal.com", active: false },
                  ].map((member) => (
                    <div key={member.email} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                          {member.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{member.name}</p>
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{member.role}</Badge>
                        <div className={`h-2 w-2 rounded-full ${member.active ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Engineering Preferences Tab */}
        <TabsContent value="engineering" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Unit System
                </CardTitle>
                <CardDescription>Default units for engineering calculations</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Temperature</Label>
                  <Select defaultValue="celsius">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="celsius">°C (Celsius)</SelectItem>
                      <SelectItem value="kelvin">K (Kelvin)</SelectItem>
                      <SelectItem value="fahrenheit">°F (Fahrenheit)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Pressure</Label>
                  <Select defaultValue="kpa">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kpa">kPa</SelectItem>
                      <SelectItem value="bar">bar</SelectItem>
                      <SelectItem value="atm">atm</SelectItem>
                      <SelectItem value="psi">psi</SelectItem>
                      <SelectItem value="mbar">mbar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Volume</Label>
                  <Select defaultValue="liters">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="liters">Liters (L)</SelectItem>
                      <SelectItem value="m3">Cubic meters (m³)</SelectItem>
                      <SelectItem value="ft3">Cubic feet (ft³)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>PGM Loading</Label>
                  <Select defaultValue="g_ft3">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="g_ft3">g/ft³</SelectItem>
                      <SelectItem value="g_L">g/L</SelectItem>
                      <SelectItem value="oz_ft3">oz/ft³</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Emission Limits</Label>
                  <Select defaultValue="g_kwh">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="g_kwh">g/kWh</SelectItem>
                      <SelectItem value="g_bhph">g/bhp-hr</SelectItem>
                      <SelectItem value="g_nm3">g/Nm³</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Default Calculation Settings</CardTitle>
                <CardDescription>Pre-fill values for CatSizer calculations</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Default Emission Standard</Label>
                  <Select defaultValue="euro_vi_e">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="euro_vi_e">Euro VI-E</SelectItem>
                      <SelectItem value="epa_tier4_final">EPA Tier 4 Final</SelectItem>
                      <SelectItem value="eu_stage_v">EU Stage V (NRMM)</SelectItem>
                      <SelectItem value="ta_luft">TA Luft 2021</SelectItem>
                      <SelectItem value="imo_tier_iii">IMO Tier III</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Default Application</Label>
                  <Select defaultValue="heavy_duty_onroad">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="heavy_duty_onroad">Heavy-Duty On-Road</SelectItem>
                      <SelectItem value="heavy_duty_offroad">Heavy-Duty Off-Road</SelectItem>
                      <SelectItem value="genset">Genset / Stationary</SelectItem>
                      <SelectItem value="marine">Marine</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Substrate Supplier Preference</Label>
                  <Select defaultValue="any">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">No Preference</SelectItem>
                      <SelectItem value="corning">Corning</SelectItem>
                      <SelectItem value="ngk">NGK</SelectItem>
                      <SelectItem value="ibiden">Ibiden</SelectItem>
                      <SelectItem value="continental">Continental / Emitec</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Safety Margin on GHSV</Label>
                  <Select defaultValue="10">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0% (Exact design point)</SelectItem>
                      <SelectItem value="10">10% (Standard)</SelectItem>
                      <SelectItem value="20">20% (Conservative)</SelectItem>
                      <SelectItem value="30">30% (High safety margin)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleSave} className="w-fit">
                  <Save className="mr-2 h-4 w-4" />
                  {saved ? "Saved!" : "Save Preferences"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notification Preferences</CardTitle>
              <CardDescription>Configure how you receive alerts and updates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { title: "Calculation Complete", desc: "Notify when a long-running calculation finishes", default: true },
                  { title: "Compliance Alerts", desc: "Alert when new emission regulations are published", default: true },
                  { title: "Catalog Updates", desc: "Notify when new substrates or materials are added", default: false },
                  { title: "System Maintenance", desc: "Scheduled downtime and update notifications", default: true },
                  { title: "Weekly Summary", desc: "Weekly digest of calculations and project activity", default: false },
                ].map((notif) => (
                  <div key={notif.title} className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="text-sm font-medium">{notif.title}</p>
                      <p className="text-xs text-muted-foreground">{notif.desc}</p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input type="checkbox" defaultChecked={notif.default} className="peer sr-only" />
                      <div className="h-5 w-9 rounded-full bg-muted peer-checked:bg-primary after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" />
                    </label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
