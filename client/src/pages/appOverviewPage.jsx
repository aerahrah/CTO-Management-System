// // src/pages/appOverviewPage.jsx
// import React from "react";
// import { Link } from "react-router-dom";
// import { useAuth } from "../store/authStore";
// import {
//   Clock,
//   Settings,
//   Users,
//   ArrowRight,
//   Command,
//   ShieldCheck,
//   ChevronRight,
// } from "lucide-react";

// // Utility for class merging
// const cx = (...c) => c.filter(Boolean).join(" ");

// const NavCard = ({ to, icon: Icon, title, desc, tag }) => (
//   <Link
//     to={to}
//     className="group relative flex flex-col p-6 bg-white border border-gray-200 rounded-xl transition-all duration-200 hover:border-gray-300 hover:shadow-sm"
//   >
//     <div className="flex items-start justify-between mb-4">
//       <div className="p-2.5 bg-gray-50 border border-gray-100 rounded-lg text-gray-700 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-100 transition-colors">
//         <Icon size={20} strokeWidth={2} />
//       </div>
//       {tag && (
//         <span className="px-2 py-1 text-[10px] font-bold tracking-wide uppercase text-indigo-600 bg-indigo-50 rounded-md">
//           {tag}
//         </span>
//       )}
//     </div>

//     <div>
//       <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
//         {title}
//         <ChevronRight
//           size={14}
//           className="opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0 text-gray-400"
//         />
//       </h3>
//       <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">{desc}</p>
//     </div>
//   </Link>
// );

// const SectionHeader = ({ title, subtitle }) => (
//   <div className="mb-6">
//     <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
//       {title}
//     </h2>
//     {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
//   </div>
// );

// export default function AppOverviewPage() {
//   const { admin } = useAuth();
//   const role = admin?.role || "employee";
//   const name = admin?.username || "User";

//   // Date formatter for a nice dashboard touch
//   const today = new Date().toLocaleDateString("en-US", {
//     weekday: "long",
//     month: "long",
//     day: "numeric",
//   });

//   return (
//     <div className="min-h-screen bg-gray-50 font-sans text-gray-900 selection:bg-indigo-100 selection:text-indigo-900">
//       {/* Top Navigation / Header Bar */}
//       <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
//         <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
//           <div className="flex items-center gap-3">
//             <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-sm">
//               <Command size={16} />
//             </div>
//             <span className="font-bold text-gray-900 tracking-tight">
//               DICT Portal
//             </span>
//             <span className="mx-2 text-gray-300">/</span>
//             <span className="text-sm font-medium text-gray-500">Overview</span>
//           </div>

//           <div className="flex items-center gap-4">
//             <div className="hidden sm:flex flex-col items-end mr-2">
//               <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
//                 {role}
//               </span>
//             </div>
//             <div className="h-8 w-8 rounded-full bg-gray-200 border border-gray-300 flex items-center justify-center text-xs font-bold text-gray-600">
//               {name.charAt(0).toUpperCase()}
//             </div>
//           </div>
//         </div>
//       </header>

//       <main className="max-w-5xl mx-auto px-6 py-12">
//         {/* Welcome Section */}
//         <section className="mb-12">
//           <p className="text-sm font-medium text-gray-500 mb-2">{today}</p>
//           <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-3">
//             Welcome back, {name}.
//           </h1>
//           <p className="text-gray-500 max-w-xl text-lg leading-relaxed">
//             Manage your time off requests, view team availability, and configure
//             your settings from this central hub.
//           </p>
//         </section>

//         {/* Apps Grid */}
//         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
//           {/* Main Action - CTO */}
//           <NavCard
//             to="/app/cto-dashboard"
//             icon={Clock}
//             title="CTO Dashboard"
//             desc="Submit requests, check leave balances, and view approval status."
//             tag="Primary"
//           />

//           {/* Admin / Employee Management */}
//           <NavCard
//             to="/app/employees"
//             icon={Users}
//             title="Employee Directory"
//             desc="Access employee records, roles, and departmental structures."
//           />

//           {/* Settings */}
//           <NavCard
//             to="/app/settings"
//             icon={Settings}
//             title="General Settings"
//             desc="Manage system preferences, notifications, and account security."
//           />
//         </div>

//         {/* Quick Stats / Info Footer (Optional minimalist addition) */}
//         <div className="mt-12 pt-8 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-8">
//           <div>
//             <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
//               <ShieldCheck size={14} className="text-emerald-500" />
//               System Status
//             </h4>
//             <p className="mt-2 text-xs text-gray-500">
//               All systems operational. Last sync: Just now.
//               <br />
//               Your current role grants you <strong>{role}</strong> level access.
//             </p>
//           </div>

//           <div className="md:text-right">
//             <Link
//               to="/app/cto-dashboard"
//               className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center md:justify-end gap-1 group"
//             >
//               Jump to Requests{" "}
//               <ArrowRight
//                 size={14}
//                 className="group-hover:translate-x-1 transition-transform"
//               />
//             </Link>
//           </div>
//         </div>
//       </main>
//     </div>
//   );
// }
