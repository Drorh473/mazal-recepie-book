'use client'
import type { Recipe } from '@/lib/types'

interface Props {
  grouped: Record<string, Recipe[]>
  withVoice: boolean
  totalCount: number
}

export default function PrintClient({ grouped, withVoice, totalCount }: Props) {
  return (
    <div dir="rtl" lang="he" className="print-page">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-page { font-family: Arial, sans-serif; }
          .recipe-card { break-inside: avoid; }
        }
        body { margin: 0; background: white; }
        .print-page { max-width: 900px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif; direction: rtl; }
        h1 { font-size: 2rem; color: #3d2c1e; text-align: center; margin-bottom: 4px; }
        .subtitle { text-align: center; color: #9e8474; font-size: 0.85rem; margin-bottom: 24px; }
        .category-title { font-size: 1.1rem; font-weight: bold; color: #3d2c1e; border-bottom: 2px solid #e5ddd5; padding-bottom: 6px; margin: 32px 0 16px; }
        .recipe-card { border: 1px solid #e5ddd5; border-radius: 8px; padding: 16px; margin-bottom: 16px; break-inside: avoid; }
        .recipe-title { font-size: 1rem; font-weight: bold; color: #3d2c1e; margin-bottom: 8px; }
        .section-label { font-size: 0.75rem; font-weight: bold; color: #9e8474; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
        .ingredients { margin: 0 0 10px; padding-right: 16px; font-size: 0.85rem; color: #3d2c1e; }
        .ingredients li { margin-bottom: 2px; }
        .instructions { font-size: 0.85rem; color: #3d2c1e; white-space: pre-line; margin: 0; }
        .audio-note { margin-top: 8px; padding: 6px 10px; background: #f5f0eb; border-radius: 6px; font-size: 0.75rem; color: #7a6555; }
        .print-toolbar { position: fixed; top: 0; left: 0; right: 0; background: #3d2c1e; padding: 10px 20px; display: flex; gap: 12px; align-items: center; z-index: 100; }
        .print-toolbar span { color: #b5a59a; font-size: 0.85rem; flex: 1; text-align: center; }
        .btn { padding: 6px 16px; border-radius: 6px; font-size: 0.85rem; cursor: pointer; border: none; }
        .btn-primary { background: #c9703a; color: white; }
        .btn-secondary { background: transparent; color: #b5a59a; border: 1px solid #b5a59a; }
        .content { margin-top: 56px; }
      `}</style>

      <div className="no-print print-toolbar">
        <button className="btn btn-secondary" onClick={() => window.close()}>✕ סגור</button>
        <span>
          ספר המתכונים של מזל — {withVoice ? 'עם הקלטות קוליות' : 'גרסת הדפסה ללא קול'}
        </span>
        <button className="btn btn-primary" onClick={() => window.print()}>
          🖨️ הדפס / שמור PDF
        </button>
      </div>

      <div className="content">
        <h1>ספר המתכונים של מזל ✦</h1>
        <p className="subtitle">{totalCount} מתכונים</p>

        {Object.entries(grouped).map(([cat, catRecipes]) => (
          <div key={cat}>
            <div className="category-title">{cat} ({catRecipes.length})</div>
            {catRecipes.map((recipe) => (
              <div key={recipe.id} className="recipe-card">
                <div className="recipe-title">{recipe.title}</div>

                <div className="section-label">מצרכים</div>
                <ul className="ingredients">
                  {recipe.ingredients.map((ing, i) => (
                    <li key={i}>{ing}</li>
                  ))}
                </ul>

                <div className="section-label">הוראות הכנה</div>
                <p className="instructions">{recipe.instructions}</p>

                {withVoice && recipe.audioPath && (
                  <div className="audio-note no-print">
                    🎙️ הקלטה קולית זמינה
                    <audio src={recipe.audioPath} controls style={{ width: '100%', marginTop: 4 }} />
                  </div>
                )}
                {withVoice && recipe.audioPath && (
                  <div className="audio-note" style={{ display: 'none' }}>
                    <style>{`.recipe-card .audio-note { display: block !important; }`}</style>
                    🎙️ הקלטה: {recipe.audioPath}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
