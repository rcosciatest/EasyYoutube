import React, { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';

// Expanded interface for form data
interface ScriptFormData {
  topicTitle: string;
  seoKeyword: string;
  creatorInfo: string;
}

const ScriptForm: React.FC = () => {
  const [formData, setFormData] = useState<ScriptFormData>({
    topicTitle: '',
    seoKeyword: '',
    creatorInfo: '',
  });
  const [generatedScript, setGeneratedScript] = useState<string>('');
  const [editableScript, setEditableScript] = useState<string>('');
  const [youtubeDescription, setYoutubeDescription] = useState<string>('');
  const [editableDescription, setEditableDescription] = useState<string>('');
  const [youtubeTags, setYoutubeTags] = useState<string>('');
  const [editableTags, setEditableTags] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isEditingDescription, setIsEditingDescription] = useState<boolean>(false);
  const [isEditingTags, setIsEditingTags] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const tagsRef = useRef<HTMLTextAreaElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleScriptEdit = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditableScript(e.target.value);
  };

  const handleDescriptionEdit = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditableDescription(e.target.value);
  };

  const handleTagsEdit = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditableTags(e.target.value);
  };

  // Format markdown for better display
  const formatMarkdown = (text: string): string => {
    // Ensure headings have proper spacing
    let formatted = text.replace(/^(#+)\s*(.+)$/gm, '\n$1 $2\n');
    
    // Ensure paragraphs have proper spacing
    formatted = formatted.replace(/\n{3,}/g, '\n\n');
    
    // Trim extra whitespace
    return formatted.trim();
  };

  // Helper functions for text formatting
  const insertFormatting = (
    format: string, 
    targetRef: React.RefObject<HTMLTextAreaElement | null>, 
    content: string, 
    setContent: React.Dispatch<React.SetStateAction<string>>
  ) => {
    if (!targetRef.current) return;
    
    const textarea = targetRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    
    let formattedText = '';
    let cursorOffset = 0;
    
    switch (format) {
      case 'h1':
        formattedText = `# ${selectedText}`;
        cursorOffset = 2;
        break;
      case 'h2':
        formattedText = `## ${selectedText}`;
        cursorOffset = 3;
        break;
      case 'bold':
        formattedText = `**${selectedText}**`;
        cursorOffset = 2;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        cursorOffset = 1;
        break;
      case 'strike':
        formattedText = `~~${selectedText}~~`;
        cursorOffset = 2;
        break;
      case 'color-red':
        formattedText = `<span style="color: red">${selectedText}</span>`;
        cursorOffset = 23;
        break;
      case 'color-blue':
        formattedText = `<span style="color: blue">${selectedText}</span>`;
        cursorOffset = 24;
        break;
      default:
        formattedText = selectedText;
    }
    
    // Insert the formatted text
    const newText = content.substring(0, start) + formattedText + content.substring(end);
    setContent(newText);
    
    // Set cursor position after the formatting
    setTimeout(() => {
      textarea.focus();
      if (selectedText) {
        // If text was selected, place cursor at the end of the formatted text
        textarea.selectionStart = start + formattedText.length;
        textarea.selectionEnd = start + formattedText.length;
      } else {
        // If no text was selected, place cursor between formatting markers
        const newPosition = start + cursorOffset;
        textarea.selectionStart = newPosition;
        textarea.selectionEnd = newPosition;
      }
    }, 0);
  };

  const toggleEditMode = () => {
    if (isEditing) {
      // Format and save changes when exiting edit mode
      const formattedScript = formatMarkdown(editableScript);
      setGeneratedScript(formattedScript);
      setEditableScript(formattedScript);
    } else {
      // Make sure editableScript is up to date when entering edit mode
      setEditableScript(generatedScript);
      // Focus the textarea when entering edit mode
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 0);
    }
    setIsEditing(!isEditing);
  };

  const toggleDescriptionEditMode = () => {
    if (isEditingDescription) {
      // Format and save changes when exiting edit mode
      const formattedDescription = formatMarkdown(editableDescription);
      setYoutubeDescription(formattedDescription);
      setEditableDescription(formattedDescription);
    } else {
      // Make sure editableDescription is up to date when entering edit mode
      setEditableDescription(youtubeDescription);
      // Focus the textarea when entering edit mode
      setTimeout(() => {
        if (descriptionRef.current) {
          descriptionRef.current.focus();
        }
      }, 0);
    }
    setIsEditingDescription(!isEditingDescription);
  };

  const toggleTagsEditMode = () => {
    if (isEditingTags) {
      setYoutubeTags(editableTags);
    } else {
      setEditableTags(youtubeTags);
      setTimeout(() => {
        if (tagsRef.current) {
          tagsRef.current.focus();
        }
      }, 0);
    }
    setIsEditingTags(!isEditingTags);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    if (!formData.topicTitle.trim() || !formData.seoKeyword.trim()) {
      setError('Please fill in both the topic title and SEO keyword');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // Add a timeout message after 10 seconds
      const timeoutId = setTimeout(() => {
        setError('This is taking longer than expected. Please wait while we generate your script...');
      }, 10000);
      
      const response = await fetch('http://localhost:5000/generate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      // Clear the timeout message
      clearTimeout(timeoutId);
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }
      
      setGeneratedScript(data.script);
      setEditableScript(data.script);
      setYoutubeDescription(data.description);
      setEditableDescription(data.description);
      setYoutubeTags(data.tags);
      setEditableTags(data.tags);
    } catch (err) {
      console.error('Error generating content:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate content. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Add this helper function to your component
  const applyFormatting = (format: string) => {
    if (textareaRef.current) {
      insertFormatting(format, textareaRef, editableScript, setEditableScript);
    }
  };

  return (
    <div className="p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="topicTitle" className="block text-sm font-medium text-gray-700 mb-1">
            Topic Title
          </label>
          <input
            type="text"
            id="topicTitle"
            name="topicTitle"
            value={formData.topicTitle}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="e.g., How to Start Investing in Stocks for Beginners"
            aria-label="Topic Title"
            tabIndex={0}
          />
        </div>
        
        <div>
          <label htmlFor="seoKeyword" className="block text-sm font-medium text-gray-700 mb-1">
            SEO Keyword
          </label>
          <input
            type="text"
            id="seoKeyword"
            name="seoKeyword"
            value={formData.seoKeyword}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="e.g., stock investing for beginners"
            aria-label="SEO Keyword"
            tabIndex={0}
          />
        </div>
        
        <div>
          <label htmlFor="creatorInfo" className="block text-sm font-medium text-gray-700 mb-1">
            Creator Information
          </label>
          <textarea
            id="creatorInfo"
            name="creatorInfo"
            value={formData.creatorInfo}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Describe yourself, your expertise, and your channel (e.g., Financial advisor with 10 years of experience, specializing in beginner-friendly investment advice)"
            rows={3}
            aria-label="Creator Information"
            tabIndex={0}
          />
        </div>
        
        <button
          type="submit"
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors duration-200"
          disabled={isLoading}
          aria-label="Generate Script"
          tabIndex={0}
        >
          {isLoading ? 'Generating...' : 'Generate Script'}
        </button>
      </form>
      
      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {generatedScript && (
        <div className="mt-8 space-y-8">
          {/* Script Section */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Your YouTube Script</h3>
              <div className="flex space-x-2">
                <button
                  onClick={toggleEditMode}
                  className="flex items-center space-x-1 text-sm bg-indigo-100 px-3 py-1.5 rounded-md hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors duration-200"
                  aria-label={isEditing ? "Save Edits" : "Edit Script"}
                  tabIndex={0}
                >
                  {isEditing ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Save Edits</span>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      <span>Edit Script</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => copyToClipboard(isEditing ? editableScript : generatedScript)}
                  className="flex items-center space-x-1 text-sm bg-gray-100 px-3 py-1.5 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors duration-200"
                  aria-label="Copy to Clipboard"
                  tabIndex={0}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  <span>Copy</span>
                </button>
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              {isEditing ? (
                <div className="w-full">
                  <div className="mb-2 flex flex-wrap gap-2 p-2 bg-gray-100 rounded-md">
                    <button 
                      onClick={() => applyFormatting('h1')}
                      className="px-2 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300 font-bold"
                      title="Heading 1"
                    >
                      H1
                    </button>
                    <button 
                      onClick={() => applyFormatting('h2')}
                      className="px-2 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300 font-bold"
                      title="Heading 2"
                    >
                      H2
                    </button>
                    <button 
                      onClick={() => applyFormatting('bold')}
                      className="px-2 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300 font-bold"
                      title="Bold Text"
                    >
                      B
                    </button>
                    <button 
                      onClick={() => applyFormatting('italic')}
                      className="px-2 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300 italic"
                      title="Italic Text"
                    >
                      I
                    </button>
                    <button 
                      onClick={() => applyFormatting('strike')}
                      className="px-2 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300 line-through"
                      title="Strikethrough Text"
                    >
                      S
                    </button>
                    <button 
                      onClick={() => applyFormatting('color-red')}
                      className="px-2 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300 text-red-600"
                      title="Red Text"
                    >
                      Red
                    </button>
                    <button 
                      onClick={() => applyFormatting('color-blue')}
                      className="px-2 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300 text-blue-600"
                      title="Blue Text"
                    >
                      Blue
                    </button>
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={editableScript}
                    onChange={handleScriptEdit}
                    className="w-full h-[450px] p-4 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner font-mono text-sm"
                    aria-label="Edit Script"
                    tabIndex={0}
                    style={{ whiteSpace: 'pre-wrap' }}
                  />
                </div>
              ) : (
                <div className="w-full h-[500px] p-4 bg-white border border-gray-300 rounded-md overflow-y-auto prose prose-sm max-w-none">
                  <ReactMarkdown rehypePlugins={[rehypeRaw]}>{generatedScript}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
          
          {/* YouTube Description Section */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">YouTube Description</h3>
              <div className="flex space-x-2">
                <button
                  onClick={toggleDescriptionEditMode}
                  className="flex items-center space-x-1 text-sm bg-indigo-100 px-3 py-1.5 rounded-md hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors duration-200"
                  aria-label={isEditingDescription ? "Save Description" : "Edit Description"}
                  tabIndex={0}
                >
                  {isEditingDescription ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Save Description</span>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      <span>Edit Description</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => copyToClipboard(isEditingDescription ? editableDescription : youtubeDescription)}
                  className="flex items-center space-x-1 text-sm bg-gray-100 px-3 py-1.5 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors duration-200"
                  aria-label="Copy Description"
                  tabIndex={0}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  <span>Copy</span>
                </button>
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              {isEditingDescription ? (
                <textarea
                  ref={descriptionRef}
                  value={editableDescription}
                  onChange={handleDescriptionEdit}
                  className="w-full h-[200px] p-4 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner font-mono text-sm"
                  aria-label="Edit YouTube Description"
                  tabIndex={0}
                  style={{ whiteSpace: 'pre-wrap' }}
                />
              ) : (
                <div className="w-full h-[200px] p-4 bg-white border border-gray-300 rounded-md overflow-y-auto whitespace-pre-wrap">
                  {youtubeDescription}
                </div>
              )}
            </div>
          </div>
          
          {/* YouTube Tags Section */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">YouTube Tags</h3>
              <div className="flex space-x-2">
                <button
                  onClick={toggleTagsEditMode}
                  className="flex items-center space-x-1 text-sm bg-indigo-100 px-3 py-1.5 rounded-md hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors duration-200"
                  aria-label={isEditingTags ? "Save Tags" : "Edit Tags"}
                  tabIndex={0}
                >
                  {isEditingTags ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Save Tags</span>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      <span>Edit Tags</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => copyToClipboard(isEditingTags ? editableTags : youtubeTags)}
                  className="flex items-center space-x-1 text-sm bg-gray-100 px-3 py-1.5 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors duration-200"
                  aria-label="Copy Tags"
                  tabIndex={0}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  <span>Copy</span>
                </button>
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              {isEditingTags ? (
                <textarea
                  ref={tagsRef}
                  value={editableTags}
                  onChange={handleTagsEdit}
                  className="w-full h-[100px] p-4 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner font-mono text-sm"
                  aria-label="Edit YouTube Tags"
                  tabIndex={0}
                  style={{ whiteSpace: 'pre-wrap' }}
                />
              ) : (
                <div className="w-full h-[100px] p-4 bg-white border border-gray-300 rounded-md overflow-y-auto">
                  {youtubeTags}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScriptForm; 