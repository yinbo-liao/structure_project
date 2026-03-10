import codecs

# Read UTF-16 file
with codecs.open('temp_restore.py', 'r', 'utf-16') as f:
    content = f.read()

# Write as UTF-8
with open('temp_restore_utf8.py', 'w', encoding='utf-8') as out:
    out.write(content)

print(f'Converted {len(content)} characters to UTF-8')

# Check the first few lines
lines = content.split('\n')
print(f'Total lines: {len(lines)}')
print('First 5 lines:')
for i, line in enumerate(lines[:5], start=1):
    print(f'{i}: {repr(line)}')