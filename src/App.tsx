import React, { useState } from 'react';
import { File, Folder, Download, Mail, Play, Code, Check, Sun, Moon, Package } from 'lucide-react';
import { androidFiles } from './fileManifest';
import AndroidSimulator from './components/AndroidSimulator';
import PixelTitle from './components/PixelTitle';
import ExportApkModal from './components/ExportApkModal';

// Importing raw strings from Vite
import readmeContent from './android-code/README.md?raw';
import gradleContent from './android-code/build.gradle.kts?raw';
import manifestContent from './android-code/AndroidManifest.xml?raw';
import mainActivityContent from './android-code/MainActivity.kt?raw';
import authManagerContent from './android-code/AuthManager.kt?raw';
import repositoryContent from './android-code/GmailRepository.kt?raw';
import viewModelContent from './android-code/MailViewModel.kt?raw';
import uiContent from './android-code/SwipeableMailStack.kt?raw';
import themeContent from './android-code/Theme.kt?raw';
import workflowContent from '../.github/workflows/build-apk.yml?raw';

const contentMap: Record<string, string> = {
  'README.md': readmeContent,
  'build.gradle.kts': gradleContent,
  'AndroidManifest.xml': manifestContent,
  'MainActivity.kt': mainActivityContent,
  'AuthManager.kt': authManagerContent,
  'GmailRepository.kt': repositoryContent,
  'MailViewModel.kt': viewModelContent,
  'SwipeableMailStack.kt': uiContent,
  'Theme.kt': themeContent,
  'build-apk.yml': workflowContent,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'simulator' | 'code'>('simulator');
  const [selectedFile, setSelectedFile] = useState(androidFiles[0]);
  const [copied, setCopied] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(contentMap[selectedFile.path]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`flex flex-col h-screen ${
        isDarkTheme ? 'bg-[#0F0F13] text-gray-200' : 'bg-[#F8FAFC] text-slate-800'
      } font-sans overflow-hidden transition-colors duration-200`}
    >
      {/* Top Application Bar */}
      <header
        className={`h-16 ${
          isDarkTheme ? 'bg-[#15151A] border-[#1E1E28]' : 'bg-white border-slate-200 shadow-sm'
        } border-b px-6 flex items-center justify-between shrink-0 z-20 transition-colors`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#007BFF] via-[#FF00FF] to-[#00FFFF] p-[2px] flex items-center justify-center">
            <div className={`w-full h-full ${isDarkTheme ? 'bg-[#0F0F13]' : 'bg-white'} rounded-[10px] flex items-center justify-center transition-colors`}>
              <Mail className={isDarkTheme ? 'text-[#00FFFF]' : 'text-sky-600'} size={20} />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <PixelTitle
                zeroColor={isDarkTheme ? '#00FFFF' : '#0284C7'}
                inboxColor={isDarkTheme ? '#FF00FF' : '#DB2777'}
                width={130}
                height={44}
              />
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase font-mono ${
                  isDarkTheme
                    ? 'bg-[#00FFFF]/10 text-[#00FFFF] border border-[#00FFFF]/30'
                    : 'bg-sky-50 text-sky-700 border border-sky-300'
                }`}
              >
                Android
              </span>
            </div>
            <p className={`text-xs mt-1 ${isDarkTheme ? 'text-gray-400' : 'text-slate-500'}`}>
              Jetpack Compose • Neon Dark & Pastel Light • Undo Snackbar
            </p>
          </div>
        </div>

        {/* Top Right Controls: Theme Switcher & View Tabs */}
        <div className="flex items-center gap-3">
          {/* Main Theme Toggle Button */}
          <button
            onClick={() => setIsDarkTheme(!isDarkTheme)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold border shadow-sm transition-all active:scale-95 ${
              isDarkTheme
                ? 'bg-[#1E1E28] border-[#2E2E3C] text-gray-200 hover:border-[#00FFFF] hover:text-white'
                : 'bg-slate-100 border-slate-300 text-slate-800 hover:border-sky-500 hover:bg-slate-200'
            }`}
            title={isDarkTheme ? 'Switch to Pastel Light Theme' : 'Switch to Neon Dark Theme'}
          >
            {isDarkTheme ? (
              <>
                <Sun size={15} className="text-amber-400" />
                <span>Pastel Light</span>
              </>
            ) : (
              <>
                <Moon size={15} className="text-indigo-600" />
                <span>Neon Dark</span>
              </>
            )}
          </button>

          {/* Package APK & Export Modal Button */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-md bg-gradient-to-r from-[#007BFF] to-[#00FFFF] hover:opacity-95 active:scale-95 transition-all"
            title="Download APK Package & GitHub Publish Instructions"
          >
            <Package size={15} />
            <span>Package APK</span>
          </button>

          {/* View Switcher Tabs */}
          <div
            className={`flex items-center p-1 rounded-xl border ${
              isDarkTheme ? 'bg-[#0F0F13] border-[#22222E]' : 'bg-slate-100 border-slate-200'
            }`}
          >
            <button
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'simulator'
                  ? (isDarkTheme ? 'bg-[#007BFF] text-white shadow-md' : 'bg-sky-600 text-white shadow-md')
                  : (isDarkTheme ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
              }`}
            >
              <Play size={14} className={activeTab === 'simulator' ? 'fill-white' : ''} />
              Interactive Demo
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'code'
                  ? (isDarkTheme ? 'bg-[#007BFF] text-white shadow-md' : 'bg-sky-600 text-white shadow-md')
                  : (isDarkTheme ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
              }`}
            >
              <Code size={14} />
              Source Files ({androidFiles.length})
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'simulator' ? (
          <div
            className={`flex-1 overflow-y-auto ${
              isDarkTheme ? 'bg-[#0A0A0F]' : 'bg-[#F1F5F9]'
            } transition-colors`}
          >
            <AndroidSimulator isDarkTheme={isDarkTheme} onToggleTheme={setIsDarkTheme} />
          </div>
        ) : (
          <div className="flex-1 flex h-full overflow-hidden">
            {/* Sidebar Navigation for Code */}
            <aside
              className={`w-72 ${
                isDarkTheme ? 'bg-[#15151A] border-[#1E1E28]' : 'bg-white border-slate-200'
              } border-r flex flex-col h-full shrink-0 transition-colors`}
            >
              <div className={`p-4 border-b ${isDarkTheme ? 'border-[#1E1E28]' : 'border-slate-200'}`}>
                <div
                  className={`flex items-center gap-2 text-xs font-semibold ${
                    isDarkTheme ? 'text-gray-400' : 'text-slate-500'
                  } uppercase tracking-wider`}
                >
                  <Folder size={15} className={isDarkTheme ? 'text-[#00FFFF]' : 'text-sky-600'} />
                  <span>Android Project Structure</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto py-3">
                <ul className="space-y-1 px-3">
                  {androidFiles.map((file) => {
                    const isSelected = selectedFile.path === file.path;
                    return (
                      <li key={file.path}>
                        <button
                          onClick={() => setSelectedFile(file)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all ${
                            isSelected
                              ? isDarkTheme
                                ? 'bg-[#007BFF]/20 text-[#00FFFF] font-semibold border border-[#007BFF]/50 shadow-sm'
                                : 'bg-sky-50 text-sky-700 font-semibold border border-sky-300 shadow-sm'
                              : isDarkTheme
                              ? 'text-gray-400 hover:bg-[#1C1C24] hover:text-gray-200'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <File
                              size={16}
                              className={
                                isSelected
                                  ? isDarkTheme
                                    ? 'text-[#00FFFF]'
                                    : 'text-sky-600'
                                  : isDarkTheme
                                  ? 'text-gray-500'
                                  : 'text-slate-400'
                              }
                            />
                            <span className="truncate">{file.path}</span>
                          </div>
                          <span
                            className={`text-[10px] uppercase font-mono ${
                              isDarkTheme ? 'text-gray-500' : 'text-slate-400'
                            }`}
                          >
                            {file.language}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </aside>

            {/* Code Content Panel */}
            <main
              className={`flex-1 flex flex-col h-full overflow-hidden relative ${
                isDarkTheme ? 'bg-[#0D0D12]' : 'bg-slate-50'
              } transition-colors`}
            >
              {/* File Header */}
              <div
                className={`h-14 border-b ${
                  isDarkTheme ? 'border-[#1E1E28] bg-[#121218]' : 'border-slate-200 bg-white'
                } flex items-center justify-between px-6 shrink-0 transition-colors`}
              >
                <div className="flex items-center gap-2 text-xs">
                  <span className={`font-mono ${isDarkTheme ? 'text-[#00FFFF]' : 'text-sky-600'}`}>
                    com.example.zeroinbox/
                  </span>
                  <span className={`font-bold ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>
                    {selectedFile.path}
                  </span>
                </div>
                <button
                  onClick={copyToClipboard}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    isDarkTheme
                      ? 'bg-[#1E1E28] hover:bg-[#2A2A38] text-white border-[#2E2E3C]'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 shadow-sm'
                  }`}
                >
                  {copied ? (
                    <Check size={14} className="text-green-500" />
                  ) : (
                    <Download size={14} />
                  )}
                  <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>

              {/* Code Viewer */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-5xl mx-auto w-full">
                  {selectedFile.language === 'markdown' ? (
                    <div
                      className={`p-8 rounded-2xl border shadow-xl transition-colors ${
                        isDarkTheme
                          ? 'bg-[#15151A] border-[#1E1E28]'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <pre
                        className={`font-sans text-sm leading-relaxed whitespace-pre-wrap ${
                          isDarkTheme ? 'text-gray-300' : 'text-slate-700'
                        }`}
                      >
                        {contentMap[selectedFile.path]}
                      </pre>
                    </div>
                  ) : (
                    <pre
                      className={`p-6 rounded-2xl overflow-x-auto border shadow-xl transition-colors ${
                        isDarkTheme
                          ? 'bg-[#15151A] border-[#1E1E28]'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <code
                        className={`text-xs font-mono leading-relaxed ${
                          isDarkTheme ? 'text-blue-200' : 'text-slate-800'
                        }`}
                      >
                        {contentMap[selectedFile.path]}
                      </code>
                    </pre>
                  )}
                </div>
              </div>
            </main>
          </div>
        )}
      </div>

      {/* Export / Package APK Modal */}
      <ExportApkModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        isDarkTheme={isDarkTheme}
      />
    </div>
  );
}
