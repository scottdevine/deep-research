# Deep Research Web UI

A modern web interface for the Deep Research tool that allows users to conduct in-depth research on any topic with AI assistance.

## Features

- **Simple, Intuitive Interface**: Clean design focused on user experience
- **Streamlined Research Process**: Collects all necessary information upfront
- **Real-time Progress Tracking**: Shows research progress with live updates
- **Attractive Results Display**: Presents findings in a well-organized format
- **Export Options**: Save reports in various formats (PDF, Markdown, Word)

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn
- Deep Research backend API running (default: http://localhost:3051)

### Installation

1. Clone the repository
2. Navigate to the web-ui directory
3. Install dependencies:

```bash
npm install
# or
yarn install
```

4. Create a `.env.local` file with the following content:

```
NEXT_PUBLIC_API_URL=http://localhost:3051
```

5. Start the development server:

```bash
npm run dev
# or
yarn dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

- `src/app`: Next.js app router pages
- `src/components`: React components organized by feature
  - `research-form`: Components for the initial form
  - `progress-tracker`: Components for tracking research progress
  - `research-results`: Components for displaying results
- `src/lib`: Utility functions and API client

## Development

### Adding New Features

1. Create new components in the appropriate directory
2. Update the API client if needed
3. Integrate the components into the main application flow

### Building for Production

```bash
npm run build
# or
yarn build
```

## Connecting to the Backend

The web UI connects to the Deep Research backend API. Make sure the backend is running and accessible at the URL specified in the `NEXT_PUBLIC_API_URL` environment variable.

## Future Enhancements

See the [enhancements.md](../enhancements.md) file for planned improvements to the web UI.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
