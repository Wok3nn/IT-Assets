"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

import { textFieldClassName } from "./text-field";

export type SearchComboboxOption = {
  id: string;
  label: string;
  description?: string;
  kind?: string;
  searchText?: string;
};

type SearchComboboxProps = {
  emptyMessage: string;
  label: string;
  onChange: (option: SearchComboboxOption | null) => void;
  options: SearchComboboxOption[];
  placeholder?: string;
  value?: string | null;
  maxVisibleOptions?: number;
};

function getOptionSearchText(option: SearchComboboxOption) {
  return [option.label, option.description, option.kind, option.searchText].filter(Boolean).join(" ").toLowerCase();
}

export function SearchCombobox({
  emptyMessage,
  label,
  maxVisibleOptions = 8,
  onChange,
  options,
  placeholder = "Search",
  value,
}: SearchComboboxProps) {
  const generatedId = useId();
  const inputId = `search-combobox-${generatedId}`;
  const listboxId = `search-combobox-list-${generatedId}`;
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectedOption = useMemo(
    () => options.find((option) => option.id === value) ?? null,
    [options, value],
  );

  const visibleOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filteredOptions = normalizedQuery
      ? options.filter((option) => getOptionSearchText(option).includes(normalizedQuery))
      : options;

    return filteredOptions.slice(0, maxVisibleOptions);
  }, [maxVisibleOptions, options, query]);

  const activeOptionId = isOpen && activeIndex >= 0 && visibleOptions[activeIndex]
    ? `${listboxId}-option-${activeIndex}`
    : undefined;

  useEffect(() => {
    if (activeIndex >= visibleOptions.length) {
      setActiveIndex(visibleOptions.length > 0 ? visibleOptions.length - 1 : -1);
    }
  }, [activeIndex, visibleOptions.length]);

  useEffect(() => {
    if (!activeOptionId || activeIndex < 0) {
      return;
    }

    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, activeOptionId]);

  function selectOption(option: SearchComboboxOption) {
    onChange(option);
    setQuery("");
    setActiveIndex(-1);
    setIsOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && visibleOptions.length > 0) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => {
        if (event.key === "ArrowDown") {
          return current < 0 ? 0 : (current + 1) % visibleOptions.length;
        }

        return current < 0 ? visibleOptions.length - 1 : (current - 1 + visibleOptions.length) % visibleOptions.length;
      });
      return;
    }

    if (event.key === "Enter" && isOpen && activeIndex >= 0 && visibleOptions[activeIndex]) {
      event.preventDefault();
      selectOption(visibleOptions[activeIndex]);
      return;
    }

    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      setIsOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor={inputId}>
        {label}
      </label>
      <input
        aria-activedescendant={activeOptionId}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={isOpen}
        autoComplete="off"
        className={textFieldClassName}
        id={inputId}
        onBlur={() => {
          window.setTimeout(() => {
            setIsOpen(false);
            setActiveIndex(-1);
          }, 100);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        role="combobox"
        type="search"
        value={query}
      />
      {isOpen ? (
        <div
          className="max-h-56 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1 dark:border-[#4b5255] dark:bg-[#34393c]"
          id={listboxId}
          role="listbox"
        >
          {visibleOptions.length > 0 ? (
            visibleOptions.map((option, index) => {
              const isSelected = selectedOption?.id === option.id;
              const isActive = activeIndex === index;

              return (
                <button
                  aria-selected={isActive || isSelected}
                  className={cn(
                    "flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition",
                    isActive
                      ? "bg-[#fff4e8] text-[#9a530f] ring-1 ring-[#f0c48d] dark:bg-[rgba(246,150,41,0.2)] dark:text-[#ffd7ab] dark:ring-[#f0a853]"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#3c4347]",
                  )}
                  id={`${listboxId}-option-${index}`}
                  key={option.id}
                  onClick={() => selectOption(option)}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  role="option"
                  type="button"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{option.label}</span>
                    {option.description ? <span className="mt-0.5 block truncate text-xs opacity-80">{option.description}</span> : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {option.kind ? (
                      <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:border-[#5b6468] dark:text-slate-300">
                        {option.kind}
                      </span>
                    ) : null}
                    {isSelected ? <span className="text-xs font-medium">Selected</span> : null}
                  </span>
                </button>
              );
            })
          ) : (
            <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>
          )}
        </div>
      ) : null}
      {selectedOption ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#f0d3b4] bg-[#fff8f0] px-3 py-2 text-sm text-slate-700 dark:border-[#6f5530] dark:bg-[rgba(246,150,41,0.12)] dark:text-slate-200">
          <span className="min-w-0 truncate">
            Selected: <span className="font-medium text-slate-950 dark:text-slate-100">{selectedOption.label}</span>
          </span>
          <button
            className="shrink-0 rounded-full px-2 py-1 text-xs font-medium text-[#b56613] transition hover:bg-white/70 dark:text-[#ffd7ab] dark:hover:bg-white/10"
            onClick={() => {
              onChange(null);
              setQuery("");
              setActiveIndex(-1);
              setIsOpen(false);
            }}
            type="button"
          >
            Clear
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">Choose a result before submitting.</p>
      )}
    </div>
  );
}
