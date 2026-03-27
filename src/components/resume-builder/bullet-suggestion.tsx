"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Suggestion } from "@/lib/actions/resume-builder";

interface BulletSuggestionProps {
  text: string;
  suggestion?: Suggestion;
  isApplied: boolean;
  onTextChange: (newText: string) => void;
}

export function BulletSuggestion({
  text,
  suggestion,
  isApplied,
  onTextChange,
}: BulletSuggestionProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditValue(text);
  }, [text]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [editing]);

  function handleBlur() {
    setEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== text) {
      onTextChange(trimmed);
    } else {
      setEditValue(text);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      textareaRef.current?.blur();
    }
    if (e.key === "Escape") {
      setEditValue(text);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <li className="relative flex items-start gap-2">
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--w-text-muted)]" />
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full resize-none rounded border border-[var(--w-primary)] bg-[var(--w-surface)] px-2 py-1 text-xs leading-relaxed text-[var(--w-text-primary)] outline-none"
          rows={1}
        />
      </li>
    );
  }

  const hasSuggestion = suggestion && !isApplied;

  return (
    <li
      role="button"
      tabIndex={0}
      className={cn(
        "group relative flex cursor-text items-start gap-2 rounded px-1 py-0.5 transition-colors hover:bg-[var(--w-surface-alt)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--w-primary)]",
        hasSuggestion && "bg-[#d97706]/5"
      )}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setEditing(true);
        }
      }}
    >
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--w-text-muted)]" />
      <span className="flex-1 text-xs leading-relaxed text-[var(--w-text-secondary)]">
        {text}
      </span>
      {hasSuggestion && (
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#d97706]" />
      )}
    </li>
  );
}
