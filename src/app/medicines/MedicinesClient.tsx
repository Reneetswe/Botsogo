'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Medicine {
  id: string;
  name: string;
  generic_name: string | null;
}

interface StockRow {
  clinic_id: string;
  medicine_id: string;
  level: string;
  updated_at: string;
}

interface Clinic {
  id: string;
  name: string;
  location: string | null;
}

interface StockWithClinic {
  clinicName: string;
  level: string;
  updatedAt: string;
}

type StockLevel = 'in_stock' | 'low' | 'out';

interface MedicineWithStock extends Medicine {
  stocks: StockWithClinic[];
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) {
    return 'Updated just now';
  } else if (diffHours < 24) {
    return `Updated ${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffDays === 1) {
    return `Updated today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays < 7) {
    return `Updated ${diffDays} days ago`;
  } else {
    return `Updated on ${date.toLocaleDateString()}`;
  }
}

function getStockLevelOrder(level: string): number {
  if (level === 'in_stock') return 0;
  if (level === 'low') return 1;
  return 2;
}

export default function MedicinesClient() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<MedicineWithStock[]>([]);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('botsogo_recent_medicines');
    if (stored) {
      setRecentSearches(JSON.parse(stored));
    }
  }, []);

  const addToRecentSearches = useCallback((term: string) => {
    setRecentSearches((current) => {
      const filtered = current.filter((t) => t.toLowerCase() !== term.toLowerCase());
      const updated = [term, ...filtered].slice(0, 5);
      localStorage.setItem('botsogo_recent_medicines', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const search = async (term: string) => {
    if (!term.trim()) {
      return;
    }

    setSearching(true);
    setError('');
    setHasSearched(true);
    setSearchTerm(term);
    addToRecentSearches(term);

    try {
      const supabase = createClient();

      const { data: medicines, error: medicinesError } = await supabase
        .from('medicines')
        .select('id, name, generic_name')
        .ilike('name', `%${term}%`)
        .order('name', { ascending: true })
        .limit(10);

      if (medicinesError) {
        setError('Unable to search right now. Please try again.');
        setResults([]);
        setSearching(false);
        return;
      }

      if (!medicines || medicines.length === 0) {
        setResults([]);
        setSearching(false);
        return;
      }

      const medicineIds = medicines.map((m) => m.id);

      const { data: stockRows } = await supabase
        .from('medicine_stock')
        .select('medicine_id, clinic_id, level, updated_at')
        .in('medicine_id', medicineIds);

      const { data: clinicRows } = await supabase
        .from('clinics')
        .select('id, name, location');

      const clinicMap = new Map((clinicRows ?? []).map((c) => [c.id, c]));

      const medicinesWithStock: MedicineWithStock[] = medicines.map((medicine) => {
        const stocks = (stockRows ?? [])
          .filter((s) => s.medicine_id === medicine.id)
          .map((stock) => {
            const clinic = clinicMap.get(stock.clinic_id);
            return {
              clinicName: clinic?.name ?? 'Unknown Clinic',
              level: stock.level,
              updatedAt: stock.updated_at,
            };
          })
          .sort((a, b) => getStockLevelOrder(a.level) - getStockLevelOrder(b.level));

        return {
          ...medicine,
          stocks,
        };
      });

      setResults(medicinesWithStock);
    } catch {
      setError('Unable to search right now. Please try again.');
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    void search(searchTerm);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setResults([]);
    setHasSearched(false);
    setError('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      void search(searchTerm);
    }
  };

  const getStockBadge = (level: string) => {
    if (level === 'in_stock') {
      return <span className="tag tmi">In stock</span>;
    }
    if (level === 'low') {
      return <span className="tag tm">Running low</span>;
    }
    return <span className="tag tc">Out of stock</span>;
  };

  return (
    <>
      <style>{`
        .medicines-search-bar { display: flex; gap: 8px; margin-bottom: 1rem; }
        .medicines-search-bar input { flex: 1; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--r); font-size: 14px; background: var(--bg); color: var(--navy); }
        .medicines-search-bar button { padding: 10px 16px; border: none; border-radius: var(--r); font-size: 14px; cursor: pointer; }
        .medicines-search-btn { background: var(--teal); color: white; }
        .medicines-search-btn:hover { background: var(--teal-dark); }
        .medicines-clear-btn { background: var(--border); color: var(--navy); }
        .medicines-clear-btn:hover { background: var(--border-dark); }
        .medicines-recent { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 1.5rem; font-size: 13; color: var(--muted); }
        .medicines-recent-chip { background: var(--bg); border: 1px solid var(--border); padding: 4px 10px; border-radius: 12px; cursor: pointer; color: var(--navy); font-size: 12px; }
        .medicines-recent-chip:hover { background: var(--border); }
        .medicines-card { background: var(--bg); border: 1px solid var(--border); border-radius: var(--r2); padding: 1rem; margin-bottom: 1rem; }
        .medicines-card h3 { margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: var(--navy); }
        .medicines-card .generic-name { font-size: 13px; color: var(--muted); margin-bottom: 12px; }
        .medicines-stock-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-top: 1px solid var(--border); font-size: 13px; }
        .medicines-stock-row:first-of-type { border-top: none; padding-top: 0; }
        .medicines-stock-clinic { color: var(--navy); }
        .medicines-stock-meta { display: flex; align-items: center; gap: 12px; }
        .medicines-updated { color: var(--muted); font-size: 11px; }
      `}</style>
      <div className="screen active" id="screen-medicines">
        <div className="auth-wrap">
          <div className="auth-card">
            <div className="auth-head">
              <div className="auth-logo"><img src="/Justlogo.png" alt="Botsogo" /></div>
              <div className="auth-h">Medicine Stock Search</div>
              <div className="auth-s">Check medicine availability across all clinics</div>
            </div>

            <form className="medicines-search-bar" onSubmit={handleSearch}>
              <input
                type="text"
                placeholder="Search for a medicine..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button type="submit" className="medicines-search-btn" disabled={searching}>
                {searching ? 'Searching...' : 'Search'}
              </button>
              {searchTerm && (
                <button type="button" className="medicines-clear-btn" onClick={clearSearch}>
                  ×
                </button>
              )}
            </form>

            {recentSearches.length > 0 && !hasSearched && (
              <div className="medicines-recent">
                <span>Recent:</span>
                {recentSearches.map((term) => (
                  <span key={term} className="medicines-recent-chip" onClick={() => void search(term)}>
                    {term}
                  </span>
                ))}
              </div>
            )}

            {error && <div className="auth-err" style={{ display: 'block', marginBottom: '1rem' }}>{error}</div>}

            {!hasSearched && !error && (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--muted)' }}>
                <div style={{ fontSize: 16, marginBottom: '0.5rem' }}>Search for any medicine to see availability across all clinics</div>
                <div style={{ fontSize: 13 }}>Try: Metformin, Amoxicillin, Paracetamol</div>
              </div>
            )}

            {hasSearched && !searching && results.length === 0 && !error && (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--muted)' }}>
                No medicine found matching '{searchTerm}'. Try a different spelling or generic name.
              </div>
            )}

            {results.map((medicine) => (
              <div className="medicines-card" key={medicine.id}>
                <h3>{medicine.name}</h3>
                {medicine.generic_name && <div className="generic-name">{medicine.generic_name}</div>}
                {medicine.stocks.length > 0 ? (
                  medicine.stocks.map((stock, index) => (
                    <div className="medicines-stock-row" key={index}>
                      <span className="medicines-stock-clinic">{stock.clinicName}</span>
                      <div className="medicines-stock-meta">
                        {getStockBadge(stock.level)}
                        <span className="medicines-updated">{formatRelativeTime(stock.updatedAt)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--muted)', padding: '8px 0' }}>No stock information available</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
