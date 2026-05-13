$files = @{
  'src/components/AdvancedProjectCreator/ProjectBuilder.tsx' = @(
    "import { BudgetTable } from '../BudgetTable'" => "import BudgetTable from '../BudgetTable'"
    "import { useState, useEffect } from 'react';" => "import { useState, useEffect, useMemo } from 'react';\nimport { Typology } from '../../constants';"
    "import { generateBudgetPDF, generateBudgetPDFAPU, generateBudgetPDFEjecutivo, generateBudgetPDFCliente } from '../../lib/reports';" => ""
    "import { addDocument } from '../../services/firestoreService';" => ""
    "import { fmtQ } from '../../utils/format';" => ""
  )
  'src/components/AdvancedProjectCreator/ProjectSummary.tsx' = @(
    "costBreakdown\.indirectCost" => "totals.indirectCost",
    "costBreakdown\.adminCost" => "totals.adminCost"
  )
  'src/components/AdvancedProjectCreator/ProjectHeader.tsx' = @(
    "(", "\n  areaTotal,\n  onAreaTotalChange,"
  )
  'src/components/AdvancedProjectCreator/PurchaseOrderPanel.tsx' = @(
    "import { toast } from 'sonner';" => "import { toast, parseError } from 'sonner';"
  )
  'src/components/GanttChart.tsx' = @(
    "import { cn } from '../utils/cn';" => "import { cn, fmtQ } from '../utils/format';"
  )
}
foreach ($filePath in $files.Keys) {
  $content = Get-Content $filePath -Raw
  foreach ($pattern in $files[$filePath].Keys) {
    $replace = $files[$filePath][$pattern]
    $content = $content -replace ([regex]::Escape($pattern), $replace) -as [string]
  }
  Set-Content -Path $filePath -Value $content -Encoding UTF8
  Write-Host "✅ Updated: $filePath"
}