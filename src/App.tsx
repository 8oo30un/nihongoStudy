import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { NotebookShell } from './components/NotebookShell'
import { PadProvider } from './components/PadProvider'
import { CategoriesPage } from './pages/CategoriesPage'
import { CategoryDetailPage } from './pages/CategoryDetailPage'
import { DiaryPage } from './pages/DiaryPage'
import { ReviewPage } from './pages/ReviewPage'
import { SearchPage } from './pages/SearchPage'
import { SettingsPage } from './pages/SettingsPage'
import { TodayPage } from './pages/TodayPage'
import { VocabPage } from './pages/VocabPage'

export function App() {
  return (
    <PadProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<NotebookShell />}>
            <Route path="/" element={<TodayPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/categories/:id" element={<CategoryDetailPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/diary" element={<DiaryPage />} />
            <Route path="/vocab" element={<VocabPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </PadProvider>
  )
}
