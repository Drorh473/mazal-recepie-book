'use client'
import { useRef, useState, type DragEvent, type ChangeEvent } from 'react'

interface Props {
  onFiles: (files: File[]) => void
  disabled?: boolean
}

export default function UploadZone({ onFiles, disabled }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const valid = Array.from(files).filter((f) =>
      ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(
        f.type.toLowerCase()
      )
    )
    if (valid.length) onFiles(valid.slice(0, 20))
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(true)
  }

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={() => setDragging(false)}
      className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
        dragging
          ? 'border-[#c9703a] bg-[#fff8f5]'
          : 'border-[#d9cfc5] bg-white hover:border-[#c9703a]'
      } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
    >
      <div className="text-4xl mb-3">📄</div>
      <p className="text-sm text-[#5c4a3a] mb-4 leading-relaxed">
        גרור לכאן תמונות של דפי מתכונים<br />
        או בחר קבצים מהמכשיר
      </p>
      <div className="flex gap-2 justify-center flex-wrap">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="px-4 py-2 text-sm rounded-lg border border-[#c9703a] text-[#c9703a] bg-white hover:bg-[#fff0eb] transition-colors font-medium"
        >
          בחר תמונה
        </button>
        <button
          type="button"
          onClick={() => folderRef.current?.click()}
          className="px-4 py-2 text-sm rounded-lg border border-[#d9cfc5] text-[#3d2c1e] bg-white hover:bg-[#f5f0eb] transition-colors font-medium"
        >
          בחר תיקייה
        </button>
      </div>
      <p className="text-xs text-[#b5a59a] mt-3">JPG · PNG · HEIC · עד 20 תמונות</p>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e: ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)}
      />
      <input
        ref={folderRef}
        type="file"
        // @ts-expect-error webkitdirectory is non-standard
        webkitdirectory=""
        multiple
        className="hidden"
        onChange={(e: ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)}
      />
    </div>
  )
}
