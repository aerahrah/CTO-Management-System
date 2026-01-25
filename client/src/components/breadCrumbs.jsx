// import React from "react";
// import { Link, useLocation } from "react-router-dom";
// import { ChevronRight, Home, ShieldCheck } from "lucide-react";

// /**
//  * Enterprise Route Map
//  * Ensures URL segments like "my-profile" look like "My Profile"
//  */
// const breadcrumbNameMap = {
//   dashboard: "Overview",
//   "my-profile": "Employee Profile",
//   "reset-password": "Account Security",
//   edit: "Edit Information",
//   employees: "Directory",
// };

// const Breadcrumbs = () => {
//   const { pathname } = useLocation();

//   // 1. Logic: Filter out empty strings, "login", and any ID-like strings
//   const pathnames = pathname.split("/").filter((x) => {
//     if (!x || x === "login") return false;
//     // Regex to catch MongoDB IDs (24 chars) or UUIDs (36 chars)
//     const isId = /^[0-9a-fA-F]{24}$/.test(x) || /^[0-9a-fA-F-]{36}$/.test(x);
//     return !isId;
//   });

//   // Don't show breadcrumbs on the main dashboard root
//   if (pathnames.length <= 1 && pathnames[0] === "dashboard") return null;

//   return (
//     <nav aria-label="Breadcrumb" className="">
//       <ol className="flex items-center space-x-0 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden w-fit">
//         {/* Home / Root Segment */}
//         <li className="flex items-center">
//           <Link
//             to="/dashboard"
//             className="flex items-center px-4 py-2.5 text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-all border-r border-slate-100"
//           >
//             <Home className="w-4 h-4" />
//           </Link>
//         </li>

//         {pathnames.map((value, index) => {
//           // 2. Logic: Create absolute paths
//           // This ensures the link is /dashboard/my-profile instead of just my-profile
//           const lastIndex = index === pathnames.length - 1;
//           const to = `/${pathnames.slice(0, index + 1).join("/")}`;

//           // Format Name: Check map, otherwise replace dashes and capitalize
//           const name =
//             breadcrumbNameMap[value] ||
//             value.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

//           // Skip redundant "Dashboard" text if Home icon is present
//           if (value === "dashboard") return null;

//           return (
//             <li
//               key={to}
//               className="flex items-center uppercase tracking-wider text-[11px] font-bold"
//             >
//               {!lastIndex ? (
//                 <Link
//                   to={to}
//                   className="flex items-center px-4 py-2.5 text-slate-400 hover:text-blue-600 hover:bg-slate-50 transition-all border-r border-slate-100 group"
//                 >
//                   {name}
//                   <ChevronRight className="w-3.5 h-3.5 ml-2 text-slate-300 group-hover:text-blue-300" />
//                 </Link>
//               ) : (
//                 <span className="px-4 py-2.5 text-blue-600 bg-blue-50/50 flex items-center">
//                   <span className="w-1 h-4 bg-blue-600 rounded-full mr-2" />
//                   {name}
//                 </span>
//               )}
//             </li>
//           );
//         })}
//       </ol>
//     </nav>
//   );
// };

// export default Breadcrumbs;
