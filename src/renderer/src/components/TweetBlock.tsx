import React from "react";

interface TweetBlockProps {
  content: string;
  mediaPath: string | null;
  onContentChange: (content: string) => void;
  onMediaChange: (path: string | null) => void;
  maxChars: number;
  suffix: string;
}

const TweetBlock: React.FC<TweetBlockProps> = ({
  content,
  mediaPath,
  onContentChange,
  onMediaChange,
  maxChars,
  suffix,
}) => {
  const charCount = content.length;
  const isOverLimit = charCount > maxChars;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // @ts-ignore
      const savedPath = await window.api.handleMediaUpload(file.path);
      onMediaChange(savedPath);
    }
  };

  return (
    <div className="tweet-editor-stage">
      <textarea
        placeholder="What's happening?"
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        style={{
          width: "100%",
          minHeight: "200px",
          borderColor: isOverLimit ? "#ff4444" : "var(--border)",
          marginBottom: "0.5rem",
          fontSize: "1.2rem",
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div className="media-selector">
          <input
            type="file"
            accept="image/*,video/*"
            onChange={handleFileChange}
            id="media-input-stage"
            style={{ display: "none" }}
          />
          <label
            htmlFor="media-input-stage"
            className="btn-secondary"
            style={{ padding: "0.6rem 1rem", cursor: "pointer" }}
          >
            {mediaPath ? "Change Media" : "📷 Attach Media"}
          </label>
          {mediaPath && (
            <span
              style={{
                marginLeft: "1rem",
                fontSize: "0.9rem",
                color: "var(--text-secondary)",
              }}
            >
              {mediaPath.split("\\").pop()?.split("/").pop()}
              <button
                onClick={() => onMediaChange(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--error)",
                  cursor: "pointer",
                  padding: "0 0.5rem",
                }}
              >
                ✕
              </button>
            </span>
          )}
        </div>

        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: "1rem",
              fontWeight: "bold",
              color: isOverLimit ? "#ff4444" : "var(--text-secondary)",
            }}
          >
            {charCount} / {maxChars}
          </div>
          <div
            style={{
              fontSize: "0.8rem",
              color: "var(--text-secondary)",
              marginTop: "0.2rem",
            }}
          >
            Suffix: "{suffix}"
          </div>
        </div>
      </div>
    </div>
  );
};

export default TweetBlock;
