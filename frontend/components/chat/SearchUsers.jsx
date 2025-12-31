'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, UserPlus } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { SearchInput } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { userAPI, setAuthToken } from '@/lib/api';
import { debounce } from '@/lib/utils';

export default function SearchUsers({ onSelect, selectedUsers = [] }) {
  const { getToken } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Debounced search
  const performSearch = useCallback(
    debounce(async (searchQuery) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const token = await getToken();
        setAuthToken(token);
        
        const response = await userAPI.searchUsers(searchQuery);
        setResults(response.data?.users || []);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsLoading(false);
      }
    }, 300),
    [getToken]
  );

  const handleChange = (e) => {
    const value = e.target. value;
    setQuery(value);
    performSearch(value);
  };

  const handleSelect = (user) => {
    onSelect?.(user);
    setQuery('');
    setResults([]);
  };

  const isSelected = (userId) => {
    return selectedUsers.some((u) => (u.id || u._id) === userId);
  };

  return (
    <div className="relative">
      <SearchInput
        placeholder="Search users..."
        value={query}
        onChange={handleChange}
        onClear={() => {
          setQuery('');
          setResults([]);
        }}
      />

      {/* Results Dropdown */}
      <AnimatePresence>
        {(results.length > 0 || isLoading) && (
          <motion.div
            initial={{ opacity:  0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-xl shadow-large z-50 overflow-hidden"
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 text-accent animate-spin" />
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto">
                {results.map((user) => (
                  <button
                    key={user.id || user._id}
                    onClick={() => handleSelect(user)}
                    disabled={isSelected(user.id || user._id)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-background-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Avatar
                      src={user.avatar}
                      name={user.username}
                      size="sm"
                    />
                    <div className="flex-1 text-left">
                      <p className="font-medium text-foreground text-sm">
                        {user.firstName || user.username}
                      </p>
                      <p className="text-xs text-foreground-secondary">
                        @{user.username}
                      </p>
                    </div>
                    {isSelected(user.id || user._id) ? (
                      <span className="text-xs text-accent">Selected</span>
                    ) : (
                      <UserPlus className="w-4 h-4 text-foreground-secondary" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </motion. div>
        )}
      </AnimatePresence>
    </div>
  );
}