import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'money', standalone: true })
export class MoneyPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    if (value == null) return '—';
    if (value >= 1_000_000) return '£' + (value / 1_000_000).toFixed(2) + 'm';
    if (value >= 1_000) return '£' + value.toLocaleString('en-GB');
    return '£' + value;
  }
}
