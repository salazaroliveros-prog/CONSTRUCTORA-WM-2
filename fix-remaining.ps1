# Fix ProjectSummary.tsx - replace costBreakdown with totals
powershell.exe -Command "Get-Item 'src/components/AdvancedProjectCreator/ProjectSummary.tsx' | ForEach-Object { $_ -replace 'costBreakdown\\.indirectCost', 'totals.indirectCost' -replace 'costBreakdown\\.adminCost', 'totals.adminCost' | Set-Content $_ }"

# Fix ProjectBuilder.tsx - add missing fields to project object
# This is more complex - need to modify the projectData object in handleSaveProject
# Let's create a backup first and then apply the fix
Copy-Item 'src/components/AdvancedProjectCreator/ProjectBuilder.tsx' 'src/components/AdvancedProjectCreator/ProjectBuilder.tsx.bak'
powershell.exe -Command "
$content = Get-Content 'src/components/AdvancedProjectCreator/ProjectBuilder.tsx' -Raw
# Find the projectData object and add missing fields
$content = $content -replace '(const projectData = \{)([^}]+)(\})', '\$1\$2, directCosts: totals.totalDirect, progress: 0, budget: totals.totalBudget\$3'
Set-Content -Path 'src/components/AdvancedProjectCreator/ProjectBuilder.tsx' -Value $content -Encoding UTF8
"
Write-Host \"✅ Applied fixes for ProjectSummary and ProjectBuilder\"