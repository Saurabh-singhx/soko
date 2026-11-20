import { useMemo, useState } from 'react';
import { Activity, ArrowUpRight, Bot, CheckCircle2, ChevronDown, Folder, GitBranch, Search, Terminal } from 'lucide-react';
import type { SwarmAgent, SwarmAgentStatus } from '../types';

const providers = { antigravity: 'Antigravity', codex: 'Codex', claude: 'Claude' };
const statuses: Record<SwarmAgentStatus, string> = {
  working: 'Working', active: 'Active', thinking: 'Thinking', awaiting_approval: 'Needs attention',
  retrying: 'Retrying', completed: 'Completed', idle: 'Idle',
};
const isActive = (a: SwarmAgent) => !['completed', 'idle'].includes(a.status);
const shortId = (id: string) => id.replace(/^(codex|claude)-/, '').slice(-8);
const tokenLabel = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

export function ActivityBoard({ agents, selectedAgentId, onSelectAgent, query, onClearSearch, isRunning, isLoading, error }: {
  agents: SwarmAgent[]; selectedAgentId: string | null; onSelectAgent: (id: string) => void;
  query: string; onClearSearch: () => void; isRunning: boolean; isLoading: boolean; error?: string | null;
}) {
  const [provider, setProvider] = useState('all');
  const [status, setStatus] = useState('all');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const groups = useMemo(() => {
    const grouped = new Map<string, { name: string; path: string; agents: SwarmAgent[] }>();
    const search = query.toLowerCase().trim();
    const byId = new Map(agents.map(a => [a.sessionId, a]));
    for (const agent of agents) {
      if (provider !== 'all' && agent.provider !== provider) continue;
      if (status === 'active' && !isActive(agent)) continue;
      if (status === 'attention' && agent.status !== 'awaiting_approval') continue;
      if (status === 'completed' && agent.status !== 'completed') continue;
      if (search && ![agent.name, agent.taskSummary, agent.provider, agent.workspace, agent.workspaceName,
        agent.sessionId, statuses[agent.status], agent.status].some(v => v?.toLowerCase().includes(search))) continue;
      const parent = byId.get(agent.parentSessionId || '');
      const path = agent.workspace || parent?.workspace || '';
      const name = agent.workspaceName || parent?.workspaceName || path.split(/[\\/]/).filter(Boolean).pop() || 'Unassigned project';
      // Equal folder names in different locations must not merge projects.
      const key = path || 'unknown-project';
      if (!grouped.has(key)) grouped.set(key, { name, path, agents: [] });
      grouped.get(key)!.agents.push(agent);
    }
    const lineage = (agent: SwarmAgent) => {
      const ids = [agent.sessionId || agent.id];
      let parent = byId.get(agent.parentSessionId || '');
      while (parent && !ids.includes(parent.sessionId || parent.id)) {
        ids.unshift(parent.sessionId || parent.id);
        parent = byId.get(parent.parentSessionId || '');
      }
      return ids.join('/');
    };
    // Keep card positions steady while timestamps and statuses update.
    for (const group of grouped.values()) group.agents.sort((a, b) => lineage(a).localeCompare(lineage(b)));
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [agents, provider, status, query]);
  const visibleCount = groups.reduce((n, [, g]) => n + g.agents.length, 0);
  const projects = new Set(agents.map(a => a.workspace).filter(Boolean)).size;
  const reset = () => { setProvider('all'); setStatus('all'); onClearSearch(); };

  return <div className="activity-board">
    <div className="activity-overview">
      <div><span className="activity-eyebrow">YOUR WORKSPACE, IN MOTION</span><h2>Every agent. One view.</h2>
        <p>Follow independent sessions and their teams across your projects.</p></div>
      <div className="activity-summary" aria-label="Activity totals">
        <span><strong>{agents.filter(isActive).length}</strong> active agents</span>
        <span><strong>{projects}</strong> {projects === 1 ? 'project' : 'projects'}</span>
      </div>
    </div>
    <div className="activity-filters">
      <div className="activity-provider-filters" role="group" aria-label="Filter by CLI provider">
        {(['all', 'antigravity', 'codex', 'claude'] as const).map(p => <button key={p} type="button"
          aria-pressed={provider === p} onClick={() => setProvider(p)} className={provider === p ? 'is-selected' : ''}>
          {p !== 'all' && <i className={`provider-dot provider-${p}`} />}
          {p === 'all' ? 'All agents' : providers[p]}<span>{p === 'all' ? agents.length : agents.filter(a => a.provider === p).length}</span>
        </button>)}
      </div>
      <select aria-label="Filter by agent status" value={status} onChange={e => setStatus(e.target.value)}>
        <option value="all">All statuses</option><option value="active">Active</option>
        <option value="attention">Needs attention</option><option value="completed">Completed</option>
      </select>
    </div>
    <div className="activity-projects">
      {groups.map(([key, group]) => <section className="activity-project" key={key}>
        <button type="button" className="activity-project-heading" aria-expanded={!collapsed.has(key)} onClick={() => setCollapsed(prev => {
          const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next;
        })}>
          <span className="activity-folder"><Folder size={17} /></span>
          <span className="activity-project-name"><strong>{group.name}</strong><small title={group.path}>{group.path || 'Project path unavailable'}</small></span>
          <span className="activity-project-count">{group.agents.length} {group.agents.length === 1 ? 'agent' : 'agents'}</span>
          <ChevronDown size={15} style={{ transform: collapsed.has(key) ? 'rotate(-90deg)' : undefined }} />
        </button>
        {!collapsed.has(key) && <div className="activity-card-grid">
          {group.agents.map(agent => <button type="button" key={agent.id} className={`activity-agent-card ${selectedAgentId === agent.id ? 'is-selected' : ''}`}
            data-provider={agent.provider || 'unknown'} aria-pressed={selectedAgentId === agent.id}
            aria-label={`Inspect ${agent.provider ? providers[agent.provider] : 'agent'}: ${agent.taskSummary || agent.name}`}
            onClick={() => onSelectAgent(agent.id)}>
            <div className="activity-card-top"><span className={`activity-provider-icon provider-${agent.provider}`}><Terminal size={16} /></span>
              <span className="activity-provider-name">{agent.provider ? providers[agent.provider] : 'CLI agent'}</span>
              <span className={`activity-status status-${agent.status}`}><i />{statuses[agent.status]}</span></div>
            <h3>{agent.taskSummary || agent.task || agent.name || 'Agent session'}</h3>
            <div className="activity-card-detail">{agent.status === 'completed' ? <CheckCircle2 size={13} /> : <Activity size={13} />}
              <span>{agent.reasoningSteps[agent.reasoningSteps.length - 1]?.title || (agent.status === 'completed' ? 'Session completed' : 'Waiting for the next update')}</span></div>
            <div className="activity-card-footer"><span title={agent.sessionId}><Bot size={12} />{shortId(agent.sessionId || agent.id)}</span>
              {agent.isSubagent ? <span title={agent.parentSessionId ? `Parent session: ${agent.parentSessionId}` : 'Parent session unavailable'}><GitBranch size={12} />{agent.parentSessionId ? `↳ ${shortId(agent.parentSessionId)}` : 'Worker'}</span> : <span>Primary agent</span>}
              {agent.totalTokens > 0 && <span>{tokenLabel(agent.totalTokens)} tokens</span>}
              <ArrowUpRight size={14} className="activity-card-arrow" /></div>
          </button>)}
        </div>}
      </section>)}
      {!visibleCount && <div className="activity-empty" role="status">
        <div className="activity-empty-icon">{agents.length ? <Search size={26} /> : <Bot size={30} />}</div>
        <h3>{agents.length ? 'No agents match these filters' : error ? 'Waiting for the bridge' : isLoading ? 'Discovering your agents…' : !isRunning ? 'Monitoring is paused' : 'Ready when your agents are'}</h3>
        <p>{agents.length ? 'Try another provider, status, project name, or session ID.' : error ? 'Activity will appear when the local bridge reconnects.' : 'Start a session in Antigravity, Codex, or Claude. Active sessions and their workers appear here automatically.'}</p>
        {agents.length > 0 ? <button type="button" onClick={reset}>Clear filters</button> : <div className="activity-empty-providers">{Object.entries(providers).map(([id, label]) => <span key={id}><i className={`provider-dot provider-${id}`} />{label}</span>)}</div>}
      </div>}
    </div>
    <footer className="activity-board-footer"><span className={isRunning && !error ? 'activity-live-dot' : ''} />
      {error ? 'Connection interrupted' : isRunning ? 'Updates automatically' : 'Updates paused'}<span> {visibleCount} of {agents.length} agents</span></footer>
  </div>;
}
