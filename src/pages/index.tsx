import { useState, useEffect } from 'react';

type AttendanceRecord = {
  id: string;
  name: string;
  loginTime: Date;
  logoutTime: Date | null;
};

export default function Home() {
  const [name, setName] = useState('');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });

  // Load records from localStorage on component mount
  useEffect(() => {
    const loadRecords = () => {
      try {
        const savedRecords = localStorage.getItem('attendanceRecords');
        if (savedRecords) {
          const parsedRecords = JSON.parse(savedRecords);
          const formattedRecords = parsedRecords.map((record: any) => ({
            ...record,
            loginTime: new Date(record.loginTime),
            logoutTime: record.logoutTime ? new Date(record.logoutTime) : null
          }));
          
          setRecords(formattedRecords);
          
          // Check for active session
          const activeSession = formattedRecords.find((r: any) => !r.logoutTime);
          if (activeSession) {
            setCurrentSessionId(activeSession.id);
          }
        }
      } catch (error) {
        console.error('Error loading records:', error);
        setError('Failed to load attendance records. Some data might be corrupted.');
      } finally {
        setIsLoading(false);
      }
    };

    loadRecords();
  }, []);

  const saveRecords = (updatedRecords: AttendanceRecord[]) => {
    try {
      localStorage.setItem('attendanceRecords', JSON.stringify(updatedRecords));
      return updatedRecords;
    } catch (storageError) {
      console.error('Failed to save to localStorage:', storageError);
      setError('Failed to save attendance. Your data might not be saved.');
      return records; // Return previous records if save fails
    }
  };

  const handleClockIn = () => {
    setError(null);
    
    // Validate input
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    if (currentSessionId) {
      setError('You are already clocked in!');
      return;
    }

    try {
      const newRecord: AttendanceRecord = {
        id: Date.now().toString(),
        name: name.trim(),
        loginTime: new Date(),
        logoutTime: null
      };

      setRecords(prevRecords => saveRecords([...prevRecords, newRecord]));
      setCurrentSessionId(newRecord.id);
    } catch (error) {
      console.error('Error during clock in:', error);
      setError('An unexpected error occurred. Please try again.');
    }
  };

  const handleClockOut = () => {
    setError(null);

    if (!currentSessionId) {
      setError('You are not currently clocked in!');
      return;
    }

    try {
      setRecords(prevRecords => {
        const updatedRecords = prevRecords.map(record => 
          record.id === currentSessionId 
            ? { ...record, logoutTime: new Date() } 
            : record
        );
        return saveRecords(updatedRecords);
      });

      setCurrentSessionId(null);
    } catch (error) {
      console.error('Error during clock out:', error);
      setError('An unexpected error occurred. Please try again.');
    }
  };

  const clearAllData = () => {
    if (window.confirm('⚠️ WARNING: This will delete ALL attendance records. Are you sure?')) {
      try {
        localStorage.removeItem('attendanceRecords');
        setRecords([]);
        setCurrentSessionId(null);
        setError('All attendance records have been cleared.');
        // Clear the error after 3 seconds
        setTimeout(() => setError(null), 3000);
      } catch (error) {
        console.error('Error clearing data:', error);
        setError('Failed to clear attendance records.');
      }
    }
  };

  // Filter records based on search term and date range
  const filteredRecords = records.filter(record => {
    const matchesSearch = record.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (dateRange.start && dateRange.end) {
      const recordDate = new Date(record.loginTime).setHours(0, 0, 0, 0);
      const startDate = new Date(dateRange.start).setHours(0, 0, 0, 0);
      const endDate = new Date(dateRange.end).setHours(23, 59, 59, 999);
      
      return matchesSearch && recordDate >= startDate && recordDate <= endDate;
    }
    
    return matchesSearch;
  });

  const exportToCSV = () => {
    try {
      const recordsToExport = (searchTerm || dateRange.start || dateRange.end) ? filteredRecords : records;
      if (recordsToExport.length === 0) {
        setError('No records to export');
        return;
      }

      // Create CSV header
      let csvContent = 'Name,Login Time,Logout Time,Duration\n';
      
      // Add each record as a row in the CSV
      recordsToExport.forEach(record => {
        const loginTime = formatDate(record.loginTime);
        const logoutTime = formatDate(record.logoutTime);
        const duration = calculateDuration(record.loginTime, record.logoutTime);
        
        // Escape any commas in the data and add quotes
        const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`;
        
        csvContent += [
          escapeCsv(record.name),
          escapeCsv(loginTime),
          escapeCsv(logoutTime),
          escapeCsv(duration)
        ].join(',') + '\n';
      });

      // Create a download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `attendance_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      // Trigger the download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error('Error exporting data:', error);
      setError('Failed to export attendance records.');
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'In Progress';
    return date.toLocaleString();
  };

  const calculateDuration = (start: Date, end: Date | null) => {
    if (!end) return 'In Progress';
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const calculateTotalHours = (recordsToCalculate: AttendanceRecord[]) => {
    return recordsToCalculate.reduce((total, record) => {
      if (record.logoutTime) {
        const diff = record.logoutTime.getTime() - record.loginTime.getTime();
        return total + diff;
      }
      return total;
    }, 0);
  };

  const calculateStats = () => {
    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Start of current week (Sunday)
    
    // Filter records for today and this week
    const todayRecords = records.filter(record => 
      new Date(record.loginTime) >= today
    );
    
    const weekRecords = records.filter(record => 
      new Date(record.loginTime) >= startOfWeek
    );
    
    // Calculate total hours
    const allTimeHours = calculateTotalHours(records);
    const todayHours = calculateTotalHours(todayRecords);
    const weekHours = calculateTotalHours(weekRecords);
    
    // Format time as H:MM
    const formatTime = (ms: number) => {
      const hours = Math.floor(ms / (1000 * 60 * 60));
      const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
    };
    
    return {
      totalRecords: records.length,
      activeSessions: records.filter(r => !r.logoutTime).length,
      allTimeHours: formatTime(allTimeHours),
      todayHours: formatTime(todayHours),
      weekHours: formatTime(weekHours),
      filteredRecords: filteredRecords.length,
      totalFilteredHours: formatTime(calculateTotalHours(filteredRecords))
    };
  };

  const stats = calculateStats();

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div>Loading attendance records...</div>
      </div>
    );
  }

  // Define proper TypeScript types for styles
  const statCardStyle: React.CSSProperties = {
    backgroundColor: 'white',
    padding: '15px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    textAlign: 'center' as const,
    border: '1px solid #e9ecef',
    transition: 'transform 0.2s, box-shadow 0.2s',
  };

  const statCardHoverStyle: React.CSSProperties = {
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
  };

  const statValueStyle: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#1c7ed6',
    marginBottom: '5px'
  };

  const statLabelStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#495057',
    opacity: 0.8
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      <h1>Employee Attendance Logger</h1>
      
      {/* Error Display */}
      {error && (
        <div style={{ 
          margin: '10px 0', 
          padding: '10px', 
          backgroundColor: '#ffebee', 
          color: '#d32f2f', 
          borderRadius: '4px',
          border: '1px solid #ef9a9a',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>⚠️ {error}</span>
          <button 
            onClick={() => setError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#d32f2f',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '0 5px'
            }}
          >
            ×
          </button>
        </div>
      )}

      <div style={{ margin: '20px 0', padding: '20px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f8f9fa' }}>
        <h2 style={{ marginTop: '0', color: '#333' }}>{currentSessionId ? 'Clock Out' : 'Clock In'}</h2>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            const { value } = e.target;
            if (value.length <= 50) {  // Prevent very long names
              setName(value);
            }
          }}
          placeholder="Enter your name"
          disabled={!!currentSessionId}
          style={{ 
            padding: '8px', 
            marginRight: '10px', 
            width: '200px',
            border: error && !name.trim() ? '1px solid #d32f2f' : '1px solid #ccc'
          }}
        />
        {currentSessionId ? (
          <button 
            onClick={handleClockOut}
            style={{ 
              padding: '8px 16px', 
              backgroundColor: '#f44336', 
              color: 'white', 
              border: 'none', 
              cursor: 'pointer',
              borderRadius: '4px'
            }}
          >
            Clock Out
          </button>
        ) : (
          <button 
            onClick={handleClockIn}
            style={{ 
              padding: '8px 16px', 
              backgroundColor: '#4CAF50', 
              color: 'white', 
              border: 'none', 
              cursor: 'pointer',
              borderRadius: '4px'
            }}
          >
            Clock In
          </button>
        )}
      </div>

      {/* Stats Summary Section */}
      <div style={{ 
        margin: '30px 0', 
        padding: '20px', 
        backgroundColor: '#f8f9fa', 
        borderRadius: '8px',
        border: '1px solid #e9ecef'
      }}>
        <h2 style={{ marginTop: '0', color: '#333', marginBottom: '20px' }}>📊 Attendance Summary</h2>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '15px',
          marginBottom: '20px'
        }}>
          {/* Total Records */}
          <div 
            style={statCardStyle}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, statCardHoverStyle);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = '';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
            }}
          >
            <div style={statValueStyle}>{stats.totalRecords}</div>
            <div style={statLabelStyle}>Total Records</div>
          </div>
          
          {/* Active Sessions */}
          <div 
            style={statCardStyle}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, statCardHoverStyle);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = '';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
            }}
          >
            <div style={statValueStyle}>{stats.activeSessions}</div>
            <div style={statLabelStyle}>Active Sessions</div>
          </div>
          
          {/* Today's Hours */}
          <div 
            style={statCardStyle}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, statCardHoverStyle);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = '';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
            }}
          >
            <div style={statValueStyle}>{stats.todayHours}</div>
            <div style={statLabelStyle}>Today's Hours</div>
          </div>
          
          {/* This Week's Hours */}
          <div 
            style={statCardStyle}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, statCardHoverStyle);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = '';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
            }}
          >
            <div style={statValueStyle}>{stats.weekHours}</div>
            <div style={statLabelStyle}>This Week</div>
          </div>
          
          {/* All Time Hours */}
          <div 
            style={statCardStyle}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, statCardHoverStyle);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = '';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
            }}
          >
            <div style={statValueStyle}>{stats.allTimeHours}</div>
            <div style={statLabelStyle}>All Time</div>
          </div>
        </div>
        
        {/* Filtered Stats */}
        {(searchTerm || dateRange.start || dateRange.end) && (
          <div style={{
            marginTop: '15px',
            padding: '12px',
            backgroundColor: '#e7f5ff',
            borderRadius: '6px',
            borderLeft: '4px solid #4dabf7',
            fontSize: '14px',
            color: '#1864ab'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Filtered Results:</div>
            <div>Showing {stats.filteredRecords} of {stats.totalRecords} records</div>
            <div>Total hours in filtered results: {stats.totalFilteredHours}</div>
          </div>
        )}
      </div>

      <div style={{ marginTop: '20px' }}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h2>Attendance Records</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={exportToCSV}
              style={{ 
                padding: '8px 16px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <span>📥</span> Export to CSV
            </button>
            <button 
              onClick={clearAllData}
              style={{ 
                padding: '8px 16px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <span>🗑️</span> Clear All
            </button>
            </div>
          </div>
          
          {/* Search and Date Range Filters */}
          <div style={{ 
            marginBottom: '15px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '15px',
            alignItems: 'flex-end'
          }}>
            <div>
              <div style={{ marginBottom: '5px', fontSize: '14px', color: '#555' }}>Search by Name</div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Enter name..."
                style={{
                  padding: '8px 12px',
                  width: '250px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <div style={{ marginBottom: '5px', fontSize: '14px', color: '#555' }}>Start Date</div>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  width: '180px'
                }}
              />
            </div>

            <div>
              <div style={{ marginBottom: '5px', fontSize: '14px', color: '#555' }}>End Date</div>
              <input
                type="date"
                value={dateRange.end}
                min={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  width: '180px'
                }}
              />
            </div>

            {(searchTerm || dateRange.start || dateRange.end) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setDateRange({ start: '', end: '' });
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  marginLeft: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <span>🔄</span> Clear Filters
              </button>
            )}

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
              <span style={{ 
                color: '#666',
                fontSize: '14px',
                backgroundColor: '#f8f9fa',
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid #eee'
              }}>
                Showing {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''}
                {(searchTerm || dateRange.start || dateRange.end) && 
                  ` (filtered from ${records.length} total)`}
              </span>
            </div>
          </div>
        </div>
        
        {filteredRecords.length === 0 ? (
          <p>No records found</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f2f2f2' }}>
                  <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Name</th>
                  <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Login Time</th>
                  <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Logout Time</th>
                  <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Duration</th>
                </tr>
              </thead>
              <tbody>
                {[...filteredRecords].reverse().map((record) => (
                  <tr 
                    key={record.id} 
                    style={{ 
                      borderBottom: '1px solid #ddd',
                      backgroundColor: record.id === currentSessionId ? '#e8f5e9' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>{record.name}</td>
                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>{formatDate(record.loginTime)}</td>
                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>{formatDate(record.logoutTime)}</td>
                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                      {calculateDuration(record.loginTime, record.logoutTime)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
