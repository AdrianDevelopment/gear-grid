# Gear Grid - Project Context

Gear Grid is a modern web application designed to help users create and manage packing lists for various types of trips, such as hiking, mountaineering, and camping.

## Project Overview

- **Purpose**: Travel packing list management ("Packliste für die nächste Reise").
- **Core Technology**: Built with **Next.js 16** (App Router) and **React 19** using **TypeScript**.
- **Visual Style**: Features a modern, immersive UI with glassmorphism effects, CSS modules, and a mouse-driven parallax background system.
- **Data Layer**: Integrated with **Supabase** for backend services (configuration in progress).

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Runtime/Package Manager**: Bun
- **Database**: Supabase (`@supabase/supabase-js`)
- **Styling**: CSS Modules, Vanilla CSS (using Geist and Geist Mono fonts)
- **Form Handling**: React Hook Form & Zod
- **Charts**: Recharts
- **Compiler**: Babel with React Compiler plugin

## Building and Running

The project uses **Bun** as the primary runtime and package manager.

- **Development**: `bun dev` - Starts the development server at http://localhost:3000
- **Build**: `bun run build` - Creates an optimized production build.
- **Start**: `bun run start` - Runs the production server.
- **Linting**: `bun run lint` - Runs ESLint for code quality checks.

## Development Conventions

- **Component Structure**: 
  - Functional components with TypeScript.
  - Use of `"use client"` for interactive components (e.g., `Home`, `Sidebar`).
- **Styling**: 
  - Prefer **CSS Modules** (`*.module.css`) for component-specific styles.
  - Global styles are located in `src/app/globals.css`.
  - Responsive design and Dark Mode (via `prefers-color-scheme`) are expected.
- **Assets**: 
  - Background images are stored in `src/assets/`.
  - SVGs are used for icons within components.
- **Data Validation**: 
  - Use **Zod** for schema definitions and data validation.
- **State Management**: 
  - Local state with React hooks; Supabase for persistence.

## Architecture

- `src/app/`: Contains the main layout and route pages.
- `src/components/`: Reusable UI components (e.g., `Navbar`, `Sidebar`).
- `src/styles/`: CSS modules for styling components and pages.
- `src/lib/`: Library configurations and utility functions (e.g., `supabase.ts`).
- `src/assets/`: Visual assets like background images and icons.
- `public/`: Static files.
