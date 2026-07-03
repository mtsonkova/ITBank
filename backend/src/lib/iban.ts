export function generateIBAN(): string {
  const digits = String(Math.floor(Math.random() * 90 + 10)); // 10–99
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let body = '';
  for (let i = 0; i < 16; i++) {
    body += chars[Math.floor(Math.random() * chars.length)];
  }
  return `IB${digits}${body}`; // 20 chars: IB + 2 digits + 16 alphanumeric
}
