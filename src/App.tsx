import React, { useState } from 'react';
import AndroidSimulator from './components/AndroidSimulator';

export default function App() {
  const [isDarkTheme, setIsDarkTheme] = useState(true);

  return (
    <div
      className={`flex flex-col h-screen ${
        isDarkTheme ? 'bg-[#0F0F13] text-gray-200' : 'bg-[#F8FAFC] text-slate-800'
      } font-sans overflow-hidden transition-colors duration-200`}
    >
      <div className="flex-1 flex overflow-hidden">
        <div
          className={`flex-1 overflow-y-auto ${
            isDarkTheme ? 'bg-[#0A0A0F]' : 'bg-[#F1F5F9]'
          } transition-colors`}
        >
          <AndroidSimulator isDarkTheme={isDarkTheme} onToggleTheme={setIsDarkTheme} />
        </div>
      </div>
    </div>
  );
}
