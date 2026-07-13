import { Component, inject } from '@angular/core';
import { MockDataService } from '../../services/mock-data';

@Component({
  selector: 'app-agents',
  imports: [],
  templateUrl: './agents.html',
  styleUrl: './agents.scss',
})
export class AgentsComponent {
  data = inject(MockDataService);

  regionColor(region: string | undefined): string {
    if (!region) return '#888';
    const m: Record<string, string> = {
      Bristol: '#2472a8', Merton: '#0f7c6b', Leeds: '#7c3aed', Hastings: '#E8601C',
    };
    return m[region] || '#888';
  }

  propertiesForAgent(agentId: string) {
    return this.data.properties.filter(p =>
      (p.phase === 'Bristol P3' && agentId === 'a1') ||
      (p.phase === 'Merton LAHF' && agentId === 'a2') ||
      (p.phase === 'Leeds P1' && agentId === 'a3') ||
      (p.phase === 'Hastings ESPH' && agentId === 'a4')
    );
  }
}
