# Web UI Implementation Plan for Deep Research Tool

This document outlines the plan for implementing a simple, focused web-based interface for the Deep Research tool. The interface will collect all questions at the start, show progress during research, and present results in an attractive format.

## 1. Technology Stack

- **Frontend**: React.js with Next.js framework
- **Styling**: Tailwind CSS for responsive design
- **Backend**: Existing Node.js application exposed as a REST API
- **Real-time Updates**: Server-Sent Events (SSE) for progress tracking

## 2. Interface Components

The interface will consist of three main sections:

### A. Initial Questions Form

A clean, step-by-step form that collects all necessary information before starting the research:

1. **Step 1: Research Query**
   - Large text field for entering the research topic or question
   - Clear instructions and examples

2. **Step 2: Research Parameters**
   - Breadth slider (1-10) with visual explanation
   - Depth slider (1-5) with visual explanation
   - Output type toggle (Report/Answer)
   - MeSH term restrictiveness selection (Low/Medium/High) with explanations

3. **Step 3: Follow-up Questions**
   - Dynamically generated based on the initial query
   - Clear text fields for answers
   - Progress indicator showing which step the user is on

### B. Progress Tracking

A visual representation of the research progress:

1. **Progress Bar**
   - Shows overall completion percentage
   - Indicates current stage (generating queries, searching, processing)

2. **Activity Feed**
   - Displays current queries being processed
   - Shows sources as they're discovered
   - Updates in real-time using Server-Sent Events

3. **Status Messages**
   - Clear, informative messages about what's happening
   - Estimated time remaining when possible

### C. Results Display

A clean, organized presentation of the research results:

1. **Report Section**
   - Collapsible sections for easy navigation
   - Proper typography for readability
   - Table of contents for longer reports

2. **Sources Section**
   - List of web sources with clickable links
   - PubMed citations in a formatted bibliography
   - Visual distinction between different source types

3. **Export Options**
   - Buttons to export as PDF, Markdown, or Word
   - Option to copy to clipboard
   - Share functionality (if user accounts are implemented)

## 3. Implementation Steps

### Phase 1: Setup and Basic Structure

1. **Create Next.js Application**
   ```bash
   npx create-next-app@latest deep-research-web --typescript
   cd deep-research-web
   npm install tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```

2. **Set Up Project Structure**
   - Create components directory
   - Set up pages for main views
   - Configure Tailwind CSS

3. **Create API Client**
   - Implement functions to communicate with backend
   - Set up error handling and loading states

### Phase 2: Form Implementation

1. **Create Form Components**
   - Implement multi-step form logic
   - Build UI components (text fields, sliders, radio buttons)
   - Add validation and error handling

2. **Implement Follow-up Questions**
   - Create API endpoint for generating questions
   - Build UI for displaying and answering questions
   - Implement state management for form data

3. **Add Form Submission**
   - Connect form to API client
   - Handle submission and transition to progress view
   - Implement error handling and retry logic

### Phase 3: Progress Tracking

1. **Create Progress Components**
   - Build progress bar and stage indicators
   - Implement activity feed
   - Design status message display

2. **Set Up Server-Sent Events**
   - Create API endpoint for progress updates
   - Implement client-side event handling
   - Add reconnection logic for reliability

3. **Add Visual Feedback**
   - Implement animations for progress updates
   - Add loading states and transitions
   - Ensure mobile responsiveness

### Phase 4: Results Display

1. **Create Results Components**
   - Build collapsible section component
   - Implement source list and citation display
   - Design export buttons and functionality

2. **Add Markdown Rendering**
   - Implement markdown parser for report content
   - Style markdown elements for readability
   - Add syntax highlighting for code blocks if needed

3. **Implement Export Functionality**
   - Add PDF export using a library like jsPDF
   - Implement Markdown export
   - Add Word export functionality

### Phase 5: Integration and Testing

1. **Connect All Components**
   - Implement main application flow
   - Add state management for the entire application
   - Ensure smooth transitions between views

2. **Test User Flows**
   - Test form submission and validation
   - Verify progress tracking accuracy
   - Test results display and export functionality

3. **Optimize Performance**
   - Implement code splitting for faster loading
   - Optimize API calls and data handling
   - Add caching where appropriate

### Phase 6: Polish and Deployment

1. **Add Final Styling**
   - Ensure consistent design language
   - Add responsive design for all screen sizes
   - Implement dark/light mode if desired

2. **Improve Accessibility**
   - Add proper ARIA labels
   - Ensure keyboard navigation works
   - Test with screen readers

3. **Deploy Application**
   - Set up production build
   - Configure hosting (Vercel, Netlify, etc.)
   - Set up analytics for usage tracking

## 4. API Endpoints

The backend will need to expose the following endpoints:

1. **POST /api/research/start**
   - Accepts form data (query, parameters, follow-up answers)
   - Returns a research ID for tracking progress

2. **GET /api/research/progress/:id**
   - Server-Sent Events endpoint
   - Sends real-time updates about research progress

3. **GET /api/research/results/:id**
   - Returns the final research results
   - Includes report, sources, and PubMed citations

4. **POST /api/questions/generate**
   - Accepts a research query
   - Returns follow-up questions based on the query

5. **POST /api/export/:format**
   - Accepts research results
   - Returns formatted export (PDF, Markdown, Word)

## 5. Component Hierarchy

```
App
├── ResearchForm
│   ├── QueryStep
│   ├── ParametersStep
│   └── FollowUpStep
├── ProgressTracker
│   ├── ProgressBar
│   ├── ActivityFeed
│   └── StatusMessage
└── ResearchResults
    ├── ReportSection
    ├── SourcesSection
    └── ExportButtons
```

## 6. State Management

For a simple application, React's built-in state management with Context API should be sufficient:

```jsx
// Create a context for the research state
const ResearchContext = React.createContext();

// Create a provider component
function ResearchProvider({ children }) {
  const [researchState, setResearchState] = useState({
    step: 'form', // 'form', 'progress', 'results'
    formData: {
      query: '',
      breadth: 4,
      depth: 2,
      outputType: 'report',
      meshRestrictiveness: 'medium',
      followUpAnswers: []
    },
    progress: {
      stage: 'initializing',
      percentage: 0,
      currentQuery: '',
      sources: []
    },
    results: null,
    error: null
  });
  
  // Functions to update state
  const startResearch = async (formData) => {
    // Implementation
  };
  
  const trackProgress = (researchId) => {
    // Implementation
  };
  
  const fetchResults = async (researchId) => {
    // Implementation
  };
  
  return (
    <ResearchContext.Provider value={{
      ...researchState,
      startResearch,
      trackProgress,
      fetchResults
    }}>
      {children}
    </ResearchContext.Provider>
  );
}
```

## 7. Timeline

A rough timeline for implementation:

- **Week 1**: Setup, basic structure, and form implementation
- **Week 2**: Progress tracking and API integration
- **Week 3**: Results display and export functionality
- **Week 4**: Testing, polish, and deployment

## 8. Future Enhancements

After the initial implementation, consider these enhancements:

1. **User Accounts**
   - Save research history
   - Personalized settings

2. **Advanced Filtering**
   - Filter sources by type
   - Sort results by relevance

3. **Collaboration Features**
   - Share research with others
   - Collaborative editing

4. **Mobile App**
   - Native mobile experience
   - Offline capabilities

## 9. Conclusion

This implementation plan provides a roadmap for creating a focused, user-friendly web interface for the Deep Research tool. By collecting all questions upfront, showing clear progress indicators, and presenting results in an attractive format, the interface will significantly improve the user experience while maintaining the powerful research capabilities of the underlying tool.
