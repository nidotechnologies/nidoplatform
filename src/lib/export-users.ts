export function downloadUsersJSON(users: any[]) {
  const json = JSON.stringify(users, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'users.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadUsersCSV(users: any[]) {
  if (users.length === 0) return;

  const headers = Object.keys(users[0]);
  const csv = [
    headers.join(','),
    ...users.map(user => 
      headers.map(h => {
        const val = user[h];
        return typeof val === 'string' ? `"${val}"` : val;
      }).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'users.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
