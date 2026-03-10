import re

with open('backend/app/routes/structure_inspections.py', 'r') as f:
    content = f.read()

# Find all NDT-related endpoints
ndt_patterns = [
    r'@router\.post\(\"/structure/ndt-status-records/ensure\".*?\n(.*?)(?=\n\n|$)',
    r'@router\.put\(\"/structure/ndt-status-records/\{record_id\}\".*?\n(.*?)(?=\n\n|$)',
    r'@router\.post\(\"/structure/ndt-status-records\".*?\n(.*?)(?=\n\n|$)',
]

for pattern in ndt_patterns:
    matches = re.findall(pattern, content, re.DOTALL)
    if matches:
        print(f'Found pattern: {pattern[:50]}...')
        for i, match in enumerate(matches[:2]):  # Show first 2 matches
            print(f'Match {i+1}:')
            print(match[:300])
            print('---')

# Also find where NDT report numbers are used
report_patterns = [
    r'rt_report_no',
    r'ut_report_no', 
    r'pt_report_no',
    r'mt_report_no',
    r'paut_report_no',
    r'tofd_report_no'
]

print('\n\nNDT report number fields found:')
for pattern in report_patterns:
    if re.search(pattern, content, re.IGNORECASE):
        print(f'  {pattern}')