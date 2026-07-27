import path from 'path'
import fs from 'fs'
import os from 'os'
import { scanAllFiles, canParseImports, getFileLanguage, isTextSourceFile } from './file_scanner'

describe('canParseImports', () => {
  it('returns true for parseable extensions', () => {
    expect(canParseImports('file.ts')).toBe(true)
    expect(canParseImports('file.py')).toBe(true)
    expect(canParseImports('file.go')).toBe(true)
    expect(canParseImports('file.rs')).toBe(true)
    expect(canParseImports('file.vue')).toBe(true)
  })

  it('returns false for non-parseable extensions', () => {
    expect(canParseImports('image.png')).toBe(false)
    expect(canParseImports('data.json')).toBe(false)
    expect(canParseImports('readme.md')).toBe(false)
  })
})

describe('getFileLanguage', () => {
  it('returns correct language for common extensions', () => {
    expect(getFileLanguage('a.ts')).toBe('js')
    expect(getFileLanguage('a.py')).toBe('python')
    expect(getFileLanguage('a.php')).toBe('php')
    expect(getFileLanguage('a.rb')).toBe('ruby')
    expect(getFileLanguage('a.java')).toBe('java')
    expect(getFileLanguage('a.cs')).toBe('csharp')
    expect(getFileLanguage('a.go')).toBe('go')
    expect(getFileLanguage('a.rs')).toBe('rust')
    expect(getFileLanguage('a.swift')).toBe('swift')
    expect(getFileLanguage('a.dart')).toBe('dart')
    expect(getFileLanguage('a.css')).toBe('css')
    expect(getFileLanguage('a.html')).toBe('html')
    expect(getFileLanguage('a.vue')).toBe('html')
  })

  it('returns unknown for unrecognized extensions', () => {
    expect(getFileLanguage('file.xyz')).toBe('unknown')
    expect(getFileLanguage('Makefile')).toBe('unknown')
  })
})

describe('isTextSourceFile', () => {
  it('returns true for source files', () => {
    expect(isTextSourceFile('a.ts')).toBe(true)
    expect(isTextSourceFile('a.py')).toBe(true)
    expect(isTextSourceFile('a.yaml')).toBe(true)
  })

  it('returns false for binary/asset files', () => {
    expect(isTextSourceFile('image.png')).toBe(false)
    expect(isTextSourceFile('style.css')).toBe(false)
    expect(isTextSourceFile('data.json')).toBe(false)
  })
})

describe('scanAllFiles', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trazia-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('scans source files recursively', () => {
    fs.mkdirSync(path.join(tmpDir, 'src'))
    fs.writeFileSync(path.join(tmpDir, 'src', 'app.ts'), 'const x = 1')
    fs.writeFileSync(path.join(tmpDir, 'src', 'utils.py'), 'print("hello")')

    const files = scanAllFiles(tmpDir, tmpDir)
    const rel = files.map(f => path.relative(tmpDir, f))
    expect(rel).toContain('src/app.ts')
    expect(rel).toContain('src/utils.py')
  })

  it('excludes node_modules', () => {
    fs.mkdirSync(path.join(tmpDir, 'node_modules'))
    fs.writeFileSync(path.join(tmpDir, 'node_modules', 'pkg.ts'), 'export {}')
    fs.writeFileSync(path.join(tmpDir, 'index.ts'), 'export {}')

    const files = scanAllFiles(tmpDir, tmpDir)
    const rel = files.map(f => path.relative(tmpDir, f))
    expect(rel).toContain('index.ts')
    expect(rel).not.toContain('node_modules/pkg.ts')
  })

  it('excludes binary files', () => {
    fs.writeFileSync(path.join(tmpDir, 'image.png'), 'fake-png')
    fs.writeFileSync(path.join(tmpDir, 'app.ts'), 'const x = 1')

    const files = scanAllFiles(tmpDir, tmpDir)
    const rel = files.map(f => path.relative(tmpDir, f))
    expect(rel).toContain('app.ts')
    expect(rel).not.toContain('image.png')
  })

  it('excludes lockfiles', () => {
    fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), '{}')
    fs.writeFileSync(path.join(tmpDir, 'index.ts'), 'export {}')

    const files = scanAllFiles(tmpDir, tmpDir)
    const rel = files.map(f => path.relative(tmpDir, f))
    expect(rel).toContain('index.ts')
    expect(rel).not.toContain('package-lock.json')
  })

  it('returns empty for non-existent directory', () => {
    const files = scanAllFiles('/nonexistent', '/nonexistent')
    expect(files).toEqual([])
  })
})
