import React, { useState, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

/**
 * NetworkMap Component
 * Interactive network visualization using force-directed graph.
 * 
 * Props:
 * - ips: array - List of IPs
 * - tabs: array - List of tabs (grouping)
 */
const NetworkMap = ({ ips, tabs }) => {
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });

    useEffect(() => {
        const nodes = [];
        const links = [];

        // Create Tab Nodes (Hubs)
        tabs.forEach(tab => {
            nodes.push({ id: `tab-${tab.id}`, name: tab.name, type: 'tab', val: 15 });
        });
        // Create Gateway Node
        nodes.push({ id: 'gateway', name: 'Gateway', type: 'gateway', val: 20 });

        // Create IP Nodes
        ips.forEach(ip => {
            nodes.push({
                id: ip.ip,
                name: ip.hostname || ip.ip,
                type: 'ip',
                status: ip.last_status,
                val: 5
            });

            // Link to Tab or Gateway
            if (ip.tab_id) {
                links.push({ source: `tab-${ip.tab_id}`, target: ip.ip });
            } else {
                links.push({ source: 'gateway', target: ip.ip });
            }
        });

        // Link Tabs to Gateway
        tabs.forEach(tab => {
            links.push({ source: 'gateway', target: `tab-${tab.id}` });
        });

        setGraphData({ nodes, links });
    }, [ips, tabs]);

    return (
        <div className="network-map-container card">
            <ForceGraph2D
                graphData={graphData}
                nodeLabel="name"
                nodeColor={node => {
                    if (node.type === 'gateway') return '#f59e0b'; // Warning
                    if (node.type === 'tab') return '#6366f1'; // Accent
                    return node.status === 'UP' ? '#10b981' : '#ef4444'; // Success : Danger
                }}
                linkColor={() => '#475569'}
                backgroundColor="#0f172a"
                nodeRelSize={6}
            />
        </div>
    );
};

export default NetworkMap;
