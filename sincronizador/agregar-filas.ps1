# Agrega filas a la tabla Tabla1 (hoja Detalle) usando el propio Excel, para conservar
# slicers, tablas dinámicas y fórmulas. PROXI, Mes y Año son columnas calculadas de la tabla:
# Excel las llena solo. Si algo falla, cierra sin guardar y el archivo queda como estaba.
# Lo usa stgo.js. Este archivo debe guardarse en UTF-8 con BOM (por la ñ de 'Año').
param([string]$Archivo, [string]$FilasJson)

# En PowerShell 5.1 ConvertFrom-Json entrega el arreglo como un solo objeto: desenrollarlo
$filas = @(Get-Content $FilasJson -Raw -Encoding UTF8 | ConvertFrom-Json | ForEach-Object { $_ })
$xl = New-Object -ComObject Excel.Application
$wb = $null
try {
  $xl.DisplayAlerts = $false
  $xl.Visible = $false
  $wb = $xl.Workbooks.Open($Archivo)
  if ($wb.ReadOnly) { throw "el Excel está abierto en otra ventana (se abrió solo lectura)" }
  # Excel rechaza llamadas mientras termina de cargar el libro: esperar a que esté listo
  for ($i = 0; $i -lt 240; $i++) {
    try { if ($xl.Ready -and $wb.Worksheets.Count -gt 0) { break } } catch {}
    Start-Sleep -Milliseconds 500
  }
  Start-Sleep -Seconds 2

  $lo = $wb.Worksheets.Item('Detalle').ListObjects.Item('Tabla1')
  # Con un filtro puesto, Excel no deja agregar filas a la tabla
  if ($lo.AutoFilter -and $lo.AutoFilter.FilterMode) { $lo.AutoFilter.ShowAllData() }
  $antes = $lo.ListRows.Count

  $col = @{}
  foreach ($c in $lo.ListColumns) { $col[[string]$c.Name] = [int]$c.Index }
  foreach ($n in 'Fecha del gasto','PROXI','PLACA','Tipo gasto','DESCRIPCION','FACT / RECIBO','KM','Monto gastado','Mes','Año') {
    if (-not $col.ContainsKey($n)) { throw "No encontré la columna '$n' en Tabla1" }
  }

  foreach ($f in $filas) {
    $r = $lo.ListRows.Add().Range
    $y, $m, $d = $f.fecha.Split('-') | ForEach-Object { [int]$_ }
    $r.Cells.Item(1, $col['Fecha del gasto']).Value2 = (Get-Date -Year $y -Month $m -Day $d).Date.ToOADate()
    $r.Cells.Item(1, $col['PLACA']).Value2 = [string]$f.placa
    $r.Cells.Item(1, $col['Tipo gasto']).Value2 = [string]$f.tipo
    $r.Cells.Item(1, $col['DESCRIPCION']).Value2 = [string]$f.desc
    if ($f.doc) {
      $celda = $r.Cells.Item(1, $col['FACT / RECIBO'])
      # Número sin ceros adelante -> número; lo demás (0014400, textos) se guarda como texto
      if ([string]$f.doc -match '^[1-9]\d{0,14}$') { $celda.Value2 = [double]$f.doc }
      else { $celda.NumberFormat = '@'; $celda.Value2 = [string]$f.doc }
    }
    if ($null -ne $f.km) { $r.Cells.Item(1, $col['KM']).Value2 = [double]$f.km }
    $r.Cells.Item(1, $col['Monto gastado']).Value2 = [double]$f.monto
  }

  # Comprobar las filas nuevas: fórmulas de PROXI, Mes y Año
  $total = $lo.ListRows.Count
  if ($total -ne $antes + $filas.Count) { throw "Se esperaban $($antes + $filas.Count) filas y hay $total" }
  $avisos = @()
  for ($i = $antes + 1; $i -le $total; $i++) {
    $r = $lo.ListRows.Item($i).Range
    $px = $r.Cells.Item(1, $col['PROXI']); $mes = $r.Cells.Item(1, $col['Mes']); $anio = $r.Cells.Item(1, $col['Año'])
    if (-not $px.HasFormula -or -not $mes.HasFormula -or -not $anio.HasFormula) {
      throw "La fila $i quedó sin las fórmulas de PROXI, Mes o Año; no se guarda"
    }
    if ($px.Text -match '#') { $avisos += "aviso: la placa $($r.Cells.Item(1, $col['PLACA']).Text) no está en Tablas (PROXI sale $($px.Text))" }
  }

  # Las tablas dinámicas se actualizan con clic derecho > Actualizar; aquí RefreshAll se traba
  $wb.Save()
  "filas en Detalle: $antes -> $total"
  $avisos
  $wb.Close($false)
  $wb = $null
} catch {
  "ERROR: $($_.Exception.Message)"
  if ($wb) { try { $wb.Close($false) } catch {} }
  $global:LASTEXITCODE = 1
} finally {
  try { $xl.Quit() } catch {}
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($xl)
}
