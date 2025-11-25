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

  // Load records from localStorage on component mount
  useEffect(() => {
    const savedRecords = localStorage.getItem('attendanceRecords');
    if (savedRecords) {
      const parsedRecords = JSON.parse(savedRecords);
      setRecords(parsedRecords.map((record: any) => ({
        ...record,
        loginTime: new Date(record.loginTime),
        logoutTime: record.logoutTime ? new Date(record.logoutTime) : null
      })));
      
      // Check if there's an active session
      const activeSession = parsedRecords.find((r: any) => !r.logoutTime);
      if (activeSession) {
        setCurrentSessionId(activeSession.id);
      }
    }
  }, []);

  // Save records to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('attendanceRecords', JSON.stringify(records));
  }, [records]);

  const handleClockIn = () => {
    if (!name.trim()) {
      alert('Please enter your name');
      return;
    }
    
    if (currentSessionId) {
      alert('You are already clocked in!');
      return;
    }

    const newRecord: AttendanceRecord = {
      id: Date.now().toString(),
      name: name.trim(),
      loginTime: new Date(),
      logoutTime: null
    };

    setRecords([...records, newRecord]);
    setCurrentSessionId(newRecord.id);
  };

  const handleClockOut = () => {
    if (!currentSessionId) {
      alert('You are not clocked in!');
      return;
    }

    setRecords(records.map(record => 
      record.id === currentSessionId 
        ? { ...record, logoutTime: new Date() } 
        : record
    ));
    
    setCurrentSessionId(null);
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

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>Employee Attendance Logger</h1>
      
      <div style={{ margin: '20px 0', padding: '20px', border: '1px solid #ddd' }}>
        <h2>{currentSessionId ? 'Clock Out' : 'Clock In'}</h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          disabled={!!currentSessionId}
          style={{ padding: '8px', marginRight: '10px', width: '200px' }}
        />
        {currentSessionId ? (
          <button 
            onClick={handleClockOut}
            style={{ padding: '8px 16px', backgroundColor: '#f44336', color: 'white', border: 'none', cursor: 'pointer' }}
          >
            Clock Out
          </button>
        ) : (
          <button 
            onClick={handleClockIn}
            style={{ padding: '8px 16px', backgroundColor: '#4CAF50', color: 'white', border: 'none', cursor: 'pointer' }}
          >
            Clock In
          </button>
        )}
      </div>

      <div style={{ marginTop: '40px' }}>
        <h2>Attendance Records</h2>
        {records.length === 0 ? (
          <p>No records found</p>
        ) : (
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
              {[...records].reverse().map((record) => (
                <tr key={record.id} style={{ borderBottom: '1px solid #ddd' }}>
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
        )}
      </div>
    </div>
  );
}
