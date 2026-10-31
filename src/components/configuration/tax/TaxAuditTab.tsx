import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Search, ClipboardList, Eye } from 'lucide-react';
import { getTaxAuditLog, type TaxAuditEntry } from '@/lib/taxEngine';

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function moduleColor(mod: string) {
  if (mod.includes('Vendor')) return 'bg-blue-100 text-blue-700';
  if (mod.includes('Client')) return 'bg-green-100 text-green-700';
  if (mod.includes('Service')) return 'bg-purple-100 text-purple-700';
  if (mod.includes('HSN') || mod.includes('SAC')) return 'bg-orange-100 text-orange-700';
  if (mod.includes('Category')) return 'bg-pink-100 text-pink-700';
  return 'bg-slate-100 text-slate-700';
}

export default function TaxAuditTab() {
  const [log] = useState<TaxAuditEntry[]>(getTaxAuditLog);
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState<TaxAuditEntry | null>(null);

  const filtered = log.filter(e =>
    e.user.toLowerCase().includes(search.toLowerCase()) ||
    e.module.toLowerCase().includes(search.toLowerCase()) ||
    (e.reason || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-blue-600" />
        <div>
          <h2 className="text-lg font-semibold">Tax Configuration Audit Log</h2>
          <p className="text-sm text-muted-foreground">
            Every tax configuration change is recorded here — user, timestamp, previous and new values
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Changes', value: log.length },
          { label: 'Vendor Changes', value: log.filter(e => e.module.includes('Vendor')).length },
          { label: 'Client Changes', value: log.filter(e => e.module.includes('Client')).length },
          { label: 'Service Changes', value: log.filter(e => e.module.includes('Service')).length },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Change History</CardTitle>
            <div className="relative">
              <Search className="absolute left-2 top-2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-8 h-8 w-64" placeholder="Search by user, module…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No audit entries yet</p>
              <p className="text-sm">Changes to tax settings will appear here automatically</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(entry.timestamp)}</TableCell>
                    <TableCell className="font-medium text-sm">{entry.user}</TableCell>
                    <TableCell>
                      <Badge className={`${moduleColor(entry.module)} border-none text-xs`}>{entry.module}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{entry.reason || '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setViewing(entry)}>
                        <Eye size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Change Details — {viewing?.module}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="font-medium">User:</span> {viewing.user}</div>
                <div><span className="font-medium">Timestamp:</span> {formatDate(viewing.timestamp)}</div>
                {viewing.clientIp && <div><span className="font-medium">Client IP:</span> {viewing.clientIp}</div>}
                {viewing.reason && <div className="col-span-2"><span className="font-medium">Reason:</span> {viewing.reason}</div>}
              </div>
              <div>
                <p className="text-sm font-medium mb-1 text-slate-600">Previous Value</p>
                <pre className="text-xs bg-slate-50 border rounded p-3 overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {(() => { try { return JSON.stringify(JSON.parse(viewing.prevValue), null, 2); } catch { return viewing.prevValue; } })()}
                </pre>
              </div>
              <div>
                <p className="text-sm font-medium mb-1 text-green-700">New Value</p>
                <pre className="text-xs bg-green-50 border border-green-200 rounded p-3 overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {(() => { try { return JSON.stringify(JSON.parse(viewing.newValue), null, 2); } catch { return viewing.newValue; } })()}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
