export const downloadVideo = (
  videoUrl: string | null,
  recordedChunks: Blob[],
  getMimeType: () => string,
  setStatus?: (status: string) => void,
  setError?: (error: string) => void
) => {
  try {
    if (!videoUrl || recordedChunks.length === 0) {
      setError?.('No video data available to download');
      return;
    }

    setStatus?.('Preparing video for download...');
    
    // Create a blob from the recorded chunks
    const blob = new Blob(recordedChunks, { type: getMimeType() });
    
    // Create a download link and trigger download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style.display = 'none';
    a.href = url;
    a.download = `recording_${new Date().toISOString()}.webm`;
    a.click();
    
    // Clean up
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    setStatus?.('Video downloaded successfully!');
  } catch (err) {
    console.error('Download error:', err);
    setError?.('Error downloading video: ' + (err instanceof Error ? err.message : String(err)));
  }
}; 