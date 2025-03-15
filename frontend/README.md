# Minecraft Clone Frontend

This is the frontend for the Minecraft Clone project, a browser-based Minecraft clone using Three.js.

## Getting Started

There are several ways to run the frontend, depending on your needs:

### Option 1: Simple HTTP Server (No Build Required)

This is the easiest way to quickly view the static version:

```bash
# From the frontend directory
python -m http.server 5174
# OR with Python 3
python3 -m http.server 5174
```

Then visit http://localhost:5174/ in your browser.

### Option 2: Development Server with Vite

For active development with hot reloading:

```bash
# Install dependencies first
npm install

# Start the development server
npm run dev
```

### Option 3: Build for Production

To create a production build:

```bash
# Install dependencies if you haven't already
npm install

# Build the project
npm run build

# Preview the production build
npm run preview
```

## Directory Structure

- `public/` - Static assets
- `src/` - Source code
  - `components/` - React components
  - `styles/` - CSS styles
  - `App.tsx` - Main application component
  - `main.tsx` - Entry point

## Technologies Used

- React
- TypeScript
- Three.js (for 3D rendering)
- Vite (build tool)

## Troubleshooting

If you encounter a 404 error:

1. Make sure you're accessing the correct URL (http://localhost:5174/)
2. Check if the server is running
3. Try using the simple HTTP server option as a fallback 