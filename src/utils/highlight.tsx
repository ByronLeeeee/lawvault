// frontend/src/utils/highlight.tsx
import React from "react";

export const highlightText = (text: string, query: string): React.ReactNode => {
  if (!query.trim()) {
    return text;
  }
  const regex = new RegExp(`(${query.split(/\s+/).join("|")})`, "gi");
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) =>
        regex.test(part) ? (
          <mark
            key={index}
            className="bg-yellow-200/60 text-base-content font-medium rounded-sm px-0.5 mx-px"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
};
