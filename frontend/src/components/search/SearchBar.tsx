import { useState } from 'react';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { SearchModal } from './SearchModal';

export function SearchBar() {
  const [value, setValue] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const debounced = useDebouncedValue(value, 300);

  const showModal = expanded && !dismissed && debounced.trim().length >= 2;

  function handleChange(next: string) {
    setValue(next);
    setDismissed(false);
  }

  function handleClose() {
    setDismissed(true);
  }

  return (
    <div className={`flex-1 transition-all ${expanded ? 'max-w-md' : 'max-w-xs'}`}>
      <div className="rounded-full bg-white/10 focus-within:bg-white/15 px-4 py-1.5 transition-colors">
        <input
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setExpanded(true)}
          onBlur={() => {
            if (!value) setExpanded(false);
          }}
          placeholder="Search…"
          data-testid="header-search-input"
          className="w-full bg-transparent outline-none text-sm text-white placeholder-white/50"
        />
      </div>

      {showModal && <SearchModal query={debounced.trim()} onClose={handleClose} />}
    </div>
  );
}
