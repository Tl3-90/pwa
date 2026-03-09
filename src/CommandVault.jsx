import React, { useState, useRef, useEffect } from 'react';
import { Search, Copy, Trash2, Clock, Zap } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '2rem',
          maxWidth: '500px',
          width: '90%',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            margin: '0 0 1.5rem',
            color: '#000',
          }}
        >
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
};

const CommandVault = () => {
  const [commands, setCommands] = useState([
    {
      id: 1,
      name: "List Process Creation Events",
      command: "Get-WinEvent -FilterHashtable @{LogName='Security'; ID=4688}",
      description: "Retrieve all process creation events from Security log for forensic analysis",
      tags: ['security', 'forensics', 'sysmon'],
      lastUsed: new Date(Date.now() - 1000 * 60 * 5),
      usageCount: 24,
    },
    {
      id: 2,
      name: "Check Sysmon Status",
      command: "$logman query \"NT6 Operational\" -ets",
      description: "Verify if Sysmon event logging is active and collecting data",
      tags: ['security', 'forensics', 'diagnostics'],
      lastUsed: new Date(Date.now() - 1000 * 60 * 30),
      usageCount: 18,
    },
    {
      id: 3,
      name: "Find Recent File Changes",
      command: "Get-ChildItem -Path C:\\ -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -gt (Get-Date).AddDays(-7) }",
      description: "Scan for files modified in the last 7 days across the system",
      tags: ['incident-response', 'forensics', 'filesystem'],
      lastUsed: new Date(Date.now() - 1000 * 60 * 120),
      usageCount: 12,
    },
    {
      id: 4,
      name: "Active Network Connections",
      command: "Get-NetTCPConnection -State Established | Select-Object LocalAddress, LocalPort, RemoteAddress, RemotePort, OwningProcess",
      description: "List all established TCP connections with their owning processes",
      tags: ['incident-response', 'networking', 'diagnostics'],
      lastUsed: new Date(Date.now() - 1000 * 60 * 60),
      usageCount: 31,
    },
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingCommand, setEditingCommand] = useState(null);
  const [formData, setFormData] = useState({ name: '', command: '', description: '', tags: '' });
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  const filteredCommands = commands.filter(cmd => {
    const matchesSearch =
      cmd.command.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cmd.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = !selectedTag || cmd.tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  const allTags = [...new Set(commands.flatMap(cmd => cmd.tags))].sort();

  const timeAgo = (date) => {
    const seconds = Math.floor((Date.now() - date) / 1000);
    if (seconds < 60) return 'now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const copyCommand = (cmd) => {
    navigator.clipboard.writeText(cmd.command);
    // Simulate usage update
    setCommands(
      commands.map(c =>
        c.id === cmd.id
          ? { ...c, lastUsed: new Date(), usageCount: c.usageCount + 1 }
          : c
      )
    );
  };

  const handleAddCommand = () => {
    if (!formData.name || !formData.command) return;
    const newCommand = {
      id: Math.max(...commands.map(c => c.id), 0) + 1,
      name: formData.name,
      command: formData.command,
      description: formData.description,
      tags: formData.tags.split(',').map(t => t.trim()).filter(t => t),
      lastUsed: new Date(),
      usageCount: 0,
    };
    setCommands([...commands, newCommand]);
    setFormData({ name: '', command: '', description: '', tags: '' });
    setShowAddModal(false);
  };

  const handleEditCommand = () => {
    if (!formData.name || !formData.command) return;
    setCommands(
      commands.map(c =>
        c.id === editingCommand.id
          ? {
              ...c,
              name: formData.name,
              command: formData.command,
              description: formData.description,
              tags: formData.tags.split(',').map(t => t.trim()).filter(t => t),
            }
          : c
      )
    );
    setFormData({ name: '', command: '', description: '', tags: '' });
    setShowEditModal(false);
    setEditingCommand(null);
  };

  const handleDeleteCommand = () => {
    setCommands(commands.filter(c => c.id !== editingCommand.id));
    setShowDeleteModal(false);
    setEditingCommand(null);
  };

  const openEditModal = (cmd) => {
    setEditingCommand(cmd);
    setFormData({
      name: cmd.name,
      command: cmd.command,
      description: cmd.description,
      tags: cmd.tags.join(', '),
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (cmd) => {
    setEditingCommand(cmd);
    setShowDeleteModal(true);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Disable keyboard shortcuts when any modal is open or an input is focused
      if (showAddModal || showEditModal || showDeleteModal) return;
      
      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'ArrowDown' && searchInputRef.current !== document.activeElement) {
        setSelectedIndex(Math.min(selectedIndex + 1, filteredCommands.length - 1));
      }
      if (e.key === 'ArrowUp' && searchInputRef.current !== document.activeElement) {
        setSelectedIndex(Math.max(selectedIndex - 1, 0));
      }
      if (e.key === 'Enter' && filteredCommands[selectedIndex] && searchInputRef.current !== document.activeElement) {
        copyCommand(filteredCommands[selectedIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, filteredCommands, showAddModal, showEditModal, showDeleteModal, copyCommand]);

  return (
    <div
      style={{
        background: '#fafafa',
        color: '#1d1d1d',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif",
        minHeight: '100vh',
        padding: '2rem',
      }}
    >
      {/* Header */}
      <div style={{ maxWidth: '900px', margin: '0 auto 2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <h1
              style={{
                fontSize: '2rem',
                fontWeight: '700',
                margin: 0,
                letterSpacing: '-0.01em',
                color: '#000',
              }}
            >
              CommandVault
            </h1>
            <p style={{ fontSize: '0.9375rem', color: '#666', margin: '0.5rem 0 0', fontWeight: '400' }}>
              Your curated PowerShell command library
            </p>
          </div>
          <button
            onClick={() => {
              setFormData({ name: '', command: '', description: '', tags: '' });
              setShowAddModal(true);
            }}
            style={{
              padding: '0.625rem 1rem',
              background: '#000',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              fontFamily: 'inherit',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseOver={(e) => {
              e.target.style.background = '#333';
            }}
            onMouseOut={(e) => {
              e.target.style.background = '#000';
            }}
          >
            + Add Command
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ maxWidth: '900px', margin: '0 auto 1.5rem' }}>
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            background: '#fff',
            border: '1px solid #e0e0e0',
            borderRadius: '10px',
            padding: '0 1rem',
            transition: 'all 0.2s ease',
          }}
        >
          <Search size={18} style={{ color: '#999', marginRight: '0.75rem', flexShrink: 0 }} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search commands..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedIndex(0);
            }}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#1d1d1d',
              padding: '0.875rem 0',
              fontSize: '1rem',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <span style={{ fontSize: '0.8125rem', color: '#999', marginLeft: '0.5rem' }}>
            {filteredCommands.length} / {commands.length}
          </span>
        </div>
      </div>

      {/* Tag Filter */}
      <div style={{ maxWidth: '900px', margin: '0 auto 1.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setSelectedTag(null)}
            style={{
              padding: '0.375rem 0.875rem',
              background: !selectedTag ? '#000' : '#f2f2f2',
              color: !selectedTag ? '#fff' : '#666',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: '500',
              fontFamily: 'inherit',
              transition: 'all 0.15s ease',
            }}
            onMouseOver={(e) => {
              if (selectedTag !== null) e.target.style.background = '#e8e8e8';
            }}
            onMouseOut={(e) => {
              if (selectedTag !== null) e.target.style.background = '#f2f2f2';
            }}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              style={{
                padding: '0.375rem 0.875rem',
                background: selectedTag === tag ? '#000' : '#f2f2f2',
                color: selectedTag === tag ? '#fff' : '#666',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                fontFamily: 'inherit',
                transition: 'all 0.15s ease',
              }}
              onMouseOver={(e) => {
                e.target.style.background = selectedTag === tag ? '#000' : '#e8e8e8';
              }}
              onMouseOut={(e) => {
                e.target.style.background = selectedTag === tag ? '#000' : '#f2f2f2';
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Command List */}
      <div
        ref={listRef}
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        {filteredCommands.length === 0 ? (
          <div
            style={{
              padding: '3rem 2rem',
              textAlign: 'center',
              color: '#999',
              background: '#f5f5f5',
              borderRadius: '10px',
              border: '1px solid #efefef',
            }}
          >
            <p style={{ margin: 0, fontSize: '0.9375rem' }}>
              {searchQuery ? 'No commands match your search.' : 'No commands saved yet.'}
            </p>
          </div>
        ) : (
          filteredCommands.map((cmd, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={cmd.id}
                onClick={() => setSelectedIndex(idx)}
                style={{
                  padding: '1rem',
                  background: isSelected ? '#fff' : '#fff',
                  border: '1px solid ' + (isSelected ? '#d0d0d0' : '#e8e8e8'),
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  boxShadow: isSelected ? '0 2px 8px rgba(0, 0, 0, 0.08)' : 'none',
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                {/* Content */}
                <div>
                  {/* Command Name */}
                  <div
                    style={{
                      fontSize: '1rem',
                      fontWeight: '600',
                      color: '#000',
                      marginBottom: '0.5rem',
                    }}
                  >
                    {cmd.name}
                  </div>

                  {/* Description + Meta */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '1rem',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.8125rem',
                        color: '#666',
                        lineHeight: '1.5',
                        flex: 1,
                      }}
                    >
                      {cmd.description}
                    </p>

                    {/* Usage Signal */}
                    <div
                      style={{
                        display: 'flex',
                        gap: '1.25rem',
                        alignItems: 'center',
                        flexShrink: 0,
                        fontSize: '0.75rem',
                        color: '#999',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Clock size={12} />
                        {timeAgo(cmd.lastUsed)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Zap size={12} />
                        {cmd.usageCount}
                      </div>
                    </div>
                  </div>

                  {/* Tags */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.875rem' }}>
                    {cmd.tags.map(tag => (
                      <span
                        key={tag}
                        style={{
                          display: 'inline-block',
                          padding: '0.25rem 0.625rem',
                          background: '#f5f5f5',
                          color: '#999',
                          border: '1px solid #e8e8e8',
                          borderRadius: '5px',
                          fontSize: '0.7rem',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => copyCommand(cmd)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.5rem 0.875rem',
                        background: '#000',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.8125rem',
                        fontWeight: '500',
                        fontFamily: 'inherit',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseOver={(e) => {
                        e.target.style.background = '#333';
                      }}
                      onMouseOut={(e) => {
                        e.target.style.background = '#000';
                      }}
                    >
                      <Copy size={13} />
                      Copy
                    </button>
                    <button
                      onClick={() => openEditModal(cmd)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.5rem 0.875rem',
                        background: '#f2f2f2',
                        color: '#666',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.8125rem',
                        fontFamily: 'inherit',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseOver={(e) => {
                        e.target.style.background = '#e8e8e8';
                      }}
                      onMouseOut={(e) => {
                        e.target.style.background = '#f2f2f2';
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => openDeleteModal(cmd)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.5rem 0.875rem',
                        background: '#f2f2f2',
                        color: '#666',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.8125rem',
                        fontFamily: 'inherit',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseOver={(e) => {
                        e.target.style.background = '#e8e8e8';
                      }}
                      onMouseOut={(e) => {
                        e.target.style.background = '#f2f2f2';
                      }}
                    >
                      <Trash2 size={13} />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          maxWidth: '900px',
          margin: '2.5rem auto 0',
          paddingTop: '1.5rem',
          borderTop: '1px solid #e8e8e8',
          fontSize: '0.8125rem',
          color: '#999',
        }}
      >
        <p style={{ margin: 0 }}>
          <kbd style={{ background: '#f2f2f2', padding: '0.25rem 0.5rem', borderRadius: '4px', fontFamily: 'inherit' }}>/</kbd>
          {' '}focus search · 
          <kbd style={{ background: '#f2f2f2', padding: '0.25rem 0.5rem', borderRadius: '4px', marginLeft: '0.5rem', fontFamily: 'inherit' }}>↑↓</kbd>
          {' '}navigate · 
          <kbd style={{ background: '#f2f2f2', padding: '0.25rem 0.5rem', borderRadius: '4px', marginLeft: '0.5rem', fontFamily: 'inherit' }}>Enter</kbd>
          {' '}copy
        </p>
      </div>

      {/* Add Command Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Command">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.375rem', color: '#000' }}>
              Command Name
            </label>
            <input
              type="text"
              placeholder="e.g., List Process Creation Events"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              style={{
                width: '100%',
                padding: '0.625rem',
                border: '1px solid #e0e0e0',
                borderRadius: '6px',
                fontSize: '0.9375rem',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.375rem', color: '#000' }}>
              PowerShell Command
            </label>
            <textarea
              placeholder="Paste your PowerShell command here"
              value={formData.command}
              onChange={(e) => setFormData({ ...formData, command: e.target.value })}
              style={{
                width: '100%',
                padding: '0.625rem',
                border: '1px solid #e0e0e0',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontFamily: "'Monaco', 'Courier New', monospace",
                boxSizing: 'border-box',
                minHeight: '80px',
                resize: 'vertical',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.375rem', color: '#000' }}>
              Description
            </label>
            <input
              type="text"
              placeholder="What does this command do?"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              style={{
                width: '100%',
                padding: '0.625rem',
                border: '1px solid #e0e0e0',
                borderRadius: '6px',
                fontSize: '0.9375rem',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.375rem', color: '#000' }}>
              Tags (comma-separated)
            </label>
            <input
              type="text"
              placeholder="forensics, incident-response, networking"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              style={{
                width: '100%',
                padding: '0.625rem',
                border: '1px solid #e0e0e0',
                borderRadius: '6px',
                fontSize: '0.9375rem',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              onClick={handleAddCommand}
              style={{
                flex: 1,
                padding: '0.625rem',
                background: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9375rem',
                fontWeight: '500',
                fontFamily: 'inherit',
                transition: 'all 0.15s ease',
              }}
              onMouseOver={(e) => {
                e.target.style.background = '#333';
              }}
              onMouseOut={(e) => {
                e.target.style.background = '#000';
              }}
            >
              Add Command
            </button>
            <button
              onClick={() => setShowAddModal(false)}
              style={{
                flex: 1,
                padding: '0.625rem',
                background: '#f2f2f2',
                color: '#666',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9375rem',
                fontFamily: 'inherit',
                transition: 'all 0.15s ease',
              }}
              onMouseOver={(e) => {
                e.target.style.background = '#e8e8e8';
              }}
              onMouseOut={(e) => {
                e.target.style.background = '#f2f2f2';
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Command Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Command">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.375rem', color: '#000' }}>
              Command Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              style={{
                width: '100%',
                padding: '0.625rem',
                border: '1px solid #e0e0e0',
                borderRadius: '6px',
                fontSize: '0.9375rem',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.375rem', color: '#000' }}>
              PowerShell Command
            </label>
            <textarea
              value={formData.command}
              onChange={(e) => setFormData({ ...formData, command: e.target.value })}
              style={{
                width: '100%',
                padding: '0.625rem',
                border: '1px solid #e0e0e0',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontFamily: "'Monaco', 'Courier New', monospace",
                boxSizing: 'border-box',
                minHeight: '80px',
                resize: 'vertical',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.375rem', color: '#000' }}>
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              style={{
                width: '100%',
                padding: '0.625rem',
                border: '1px solid #e0e0e0',
                borderRadius: '6px',
                fontSize: '0.9375rem',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.375rem', color: '#000' }}>
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              style={{
                width: '100%',
                padding: '0.625rem',
                border: '1px solid #e0e0e0',
                borderRadius: '6px',
                fontSize: '0.9375rem',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              onClick={handleEditCommand}
              style={{
                flex: 1,
                padding: '0.625rem',
                background: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9375rem',
                fontWeight: '500',
                fontFamily: 'inherit',
                transition: 'all 0.15s ease',
              }}
              onMouseOver={(e) => {
                e.target.style.background = '#333';
              }}
              onMouseOut={(e) => {
                e.target.style.background = '#000';
              }}
            >
              Save Changes
            </button>
            <button
              onClick={() => setShowEditModal(false)}
              style={{
                flex: 1,
                padding: '0.625rem',
                background: '#f2f2f2',
                color: '#666',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9375rem',
                fontFamily: 'inherit',
                transition: 'all 0.15s ease',
              }}
              onMouseOver={(e) => {
                e.target.style.background = '#e8e8e8';
              }}
              onMouseOut={(e) => {
                e.target.style.background = '#f2f2f2';
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Command">
        <div>
          <p style={{ color: '#666', marginBottom: '1.5rem' }}>
            Are you sure you want to delete "<strong>{editingCommand?.name}</strong>"? This action cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleDeleteCommand}
              style={{
                flex: 1,
                padding: '0.625rem',
                background: '#ff4444',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9375rem',
                fontWeight: '500',
                fontFamily: 'inherit',
                transition: 'all 0.15s ease',
              }}
              onMouseOver={(e) => {
                e.target.style.background = '#dd3333';
              }}
              onMouseOut={(e) => {
                e.target.style.background = '#ff4444';
              }}
            >
              Delete
            </button>
            <button
              onClick={() => setShowDeleteModal(false)}
              style={{
                flex: 1,
                padding: '0.625rem',
                background: '#f2f2f2',
                color: '#666',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9375rem',
                fontFamily: 'inherit',
                transition: 'all 0.15s ease',
              }}
              onMouseOver={(e) => {
                e.target.style.background = '#e8e8e8';
              }}
              onMouseOut={(e) => {
                e.target.style.background = '#f2f2f2';
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CommandVault;
