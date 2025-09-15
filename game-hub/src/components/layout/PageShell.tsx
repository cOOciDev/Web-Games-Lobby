// =============================
// File: src/components/layout/PageShell.tsx
// =============================
import React from 'react'


type Props = { children: React.ReactNode }


export default function PageShell({ children }: Props) {
return <div className="p-4 md:p-6 lg:p-8">{children}</div>
}