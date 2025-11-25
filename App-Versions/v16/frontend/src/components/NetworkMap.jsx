import React, { useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

const NetworkMap = ({ ips }) => {
    const data = useMemo(() => {
        const nodes = ips.map(ip => ({
            id: ip.ip,
            group: ip.status,
            val: 1
        }));
        return { nodes, links: [] };
    }, [ips]);

    return (
        <div className="network-map-container" style={{ height: '600px', border: 'var(--glass-border)', borderRadius: '16px', overflow: 'hidden', background: 'var(--bg-dark)' }}>
            <ForceGraph2D
                graphData={data}
                nodeLabel="id"
                nodeAutoColorBy="group"
                backgroundColor="#0f172a"
                nodeRelSize={6}
                linkColor={() => 'rgba(255,255,255,0.2)'}
            />
        </div>
    );
};

export default NetworkMap;
