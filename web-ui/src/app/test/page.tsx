'use client';

export default function TestPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Test Page</h1>
      <p className="mb-4">This is a simple test page to verify that Next.js is working correctly.</p>
      <button 
        onClick={() => alert('Button clicked!')}
        className="px-4 py-2 bg-blue-600 text-white rounded-md"
      >
        Click Me
      </button>
    </div>
  );
}
