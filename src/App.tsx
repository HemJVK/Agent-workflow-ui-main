import React, { useState, useCallback, useRef, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Signup from './pages/Signup';
import TutorialPage from './pages/TutorialPage';
import AdminBootstrap from './pages/AdminBootstrap';
import TotpSetup from './pages/TotpSetup';
import { isAuthenticated, getAuthUser, getToken, setAuthUser } from './utils/auth';
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Moon,
  Sun,
  Zap,
  Loader2,
  Save,
  FolderOpen,
  ExternalLink,
  Activity,
  Download,
  Upload,
  User as UserIcon,
  Bot,
  Coins,
  Monitor,
} from "lucide-react";
import { SavedWorkflowsList, SAMPLE_WORKFLOWS } from "./components/SavedWorkflowsList";
import McpMarketplace from "./components/McpMarketplace";
import Sidebar from "./components/Sidebar";
import { useUndoRedo } from "./hooks/useUndoRedo";
import { useClipboard } from "./hooks/useClipboard";
import { HttpNode } from "./components/workflowNodes/HttpNode";
import { LoopNode } from "./components/workflowNodes/LoopNode";
import { RouterNode } from "./components/workflowNodes/RouterNode";
import { StartNode } from "./components/workflowNodes/StartNode";
import { ParallelNode } from "./components/workflowNodes/ParallelNode";
import { DynamicNode } from "./components/workflowNodes/DynamicNode";
import DynamicPropertyPanel from "./components/nodes/DynamicPropertyPanel";
import { EndNode } from "./components/nodes/EndNode";
import TutorialOverlay from "./components/TutorialOverlay";
import PhoneEnrollmentPrompt from "./components/PhoneEnrollmentPrompt";
import ProfileModal from "./components/ProfileModal";
import AgentsPage from "./pages/AgentsPage";
import WorkflowHelperPanel from "./components/WorkflowHelperPanel";
import AdminUsersPage from "./pages/AdminUsersPage";
import { SystemStatus } from "./components/SystemStatus";

// 1. REGISTER THE NODE TYPES
// Helper for UUID detection
const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

const nodeTypes = {
  trigger_start: StartNode,
  trigger_end: EndNode,
  start: StartNode,

  // DB Nodes
  query_db_postgres: DynamicNode,

  // Logic Nodes
  logic_condition: DynamicNode,
  logic_router: RouterNode,
  logic_wait: DynamicNode,
  logic_loop: LoopNode,
  logic_parallel: ParallelNode,

  // Communication Nodes
  tool_gmail: DynamicNode,
  send_sms_twilio: DynamicNode,
  send_email_sendgrid: DynamicNode,
  make_voice_call_twilio: DynamicNode,

  // HTTP Nodes
  make_http_call: HttpNode,

  // LLM Nodes
  ai_agent: DynamicNode,
  tool_generic_llm: DynamicNode,
  agent_researcher: DynamicNode,

  // Fallback Node
  default: DynamicNode,
};

const initialNodes: Node[] = [
  {
    id: "start_node",
    type: "trigger_start",
    position: { x: 400, y: 100 },
    data: {
      label: "Start Trigger",
      type: "trigger_start",
      config: { triggerType: "Webhook" },
      status: "idle",
    },
  },
];

const AppContent = () => {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'system';
  });

  const [systemIsDark, setSystemIsDark] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const isDarkMode = theme === 'system' ? systemIsDark : theme === 'dark';

  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [id, setId] = useState<string>("");
  const [workflowId, setWorkflowId] = useState<string>("");
  const [, setRunId] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [showSavedList, setShowSavedList] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [showTutorialOverlay, setShowTutorialOverlay] = useState(false);
  const [showPhonePrompt, setShowPhonePrompt] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAgentsPage, setShowAgentsPage] = useState(false);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    const root = window.document.documentElement;
    root.classList.remove("dark", "light");
    if (isDarkMode) root.classList.add("dark");
    else root.classList.add("light");
  }, [theme, isDarkMode]);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState("Untitled Workflow");

  const { takeSnapshot } = useUndoRedo(nodes, edges, setNodes, setEdges);
  const { copy, paste, cut, duplicate } = useClipboard(setNodes, setEdges, takeSnapshot);

  // Load from URL Query Parameter immediately on mount
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const urlWorkflowId = searchParams.get('workflowId');
    if (urlWorkflowId) {
      const templateMatch = SAMPLE_WORKFLOWS.find((wf) => wf.id === urlWorkflowId);
      if (templateMatch) {
        setNodes((templateMatch.nodes as Node[]) || []);
        setEdges((templateMatch.edges as Edge[]) || []);
        setWorkflowName((templateMatch.name as string) || "Untitled Workflow");
        // Templates are NEW drafts, reset IDs
        setId("");
        setWorkflowId("");
      } else {
        fetch(`/api/workflows/${urlWorkflowId}`, {
          headers: { "Authorization": `Bearer ${getToken()}` }
        })
          .then(res => {
            if (!res.ok) throw new Error("Workflow not found");
            return res.json();
          })
          .then(data => {
            setNodes((data.nodes as Node[]) || []);
            setEdges((data.edges as Edge[]) || []);
            setWorkflowName((data.name as string) || "Untitled Workflow");
            setId(data.id as string);
            setWorkflowId(data.workflowId as string);
          })
          .catch(err => console.error(err));
      }
    }
  }, [setNodes, setEdges]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable) {
        return; // Do not trigger map actions when typing in a form
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      if (cmdKey && e.key.toLowerCase() === 'c') {
        const selectedNodes = nodes.filter(n => n.selected);
        const selectedEdges = edges.filter(e => e.selected);
        copy(selectedNodes, selectedEdges);
      } else if (cmdKey && e.key.toLowerCase() === 'x') {
        const selectedNodes = nodes.filter(n => n.selected);
        const selectedEdges = edges.filter(e => e.selected);
        cut(selectedNodes, selectedEdges);
      } else if (cmdKey && e.key.toLowerCase() === 'v') {
        paste();
      } else if (cmdKey && e.key.toLowerCase() === 'd') {
        e.preventDefault(); // Prevent default browser bookmark or other actions
        const selectedNodes = nodes.filter(n => n.selected);
        const selectedEdges = edges.filter(e => e.selected);
        duplicate(selectedNodes, selectedEdges);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, edges, copy, paste, cut, duplicate]);

  useEffect(() => {
    const user = getAuthUser();
    if (user && user.has_seen_tutorial === false) {
      setShowTutorialOverlay(true);
    } else if (user && !user.phone_number) {
      setShowPhonePrompt(true);
    }

    // Fetch credit balance on mount
    const token = getToken();
    if (token) {
      fetch('/api/credits/balance', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then((d: any) => setCreditBalance(d.balance ?? null))
        .catch(() => { });
    }
  }, []);

  const handleTutorialClose = async () => {
    setShowTutorialOverlay(false);
    try {
      await fetch('/api/auth/tutorial-seen', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` },
      });
      // Update local storage user state
      const user = getAuthUser();
      if (user) {
        user.has_seen_tutorial = true;
        setAuthUser(user);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openTemporalHistory = () => {
    // 1. Detect Environment
    // Vite sets import.meta.env.DEV to true when running 'npm run dev'
    const isDev = import.meta.env.DEV;

    // 2. Choose Base URL
    // Dev: Direct connection to Temporal (bypassing Vite proxy issue)
    // Prod: Use the '/temporal' proxy path (assuming Docker setup allows it)
    const baseUrl = isDev
      ? import.meta.env.VITE_NEXT_PUBLIC_TEMPORAL_UI_URL
      : "/temporal";

    const namespace = import.meta.env.VITE_NEXT_PUBLIC_TEMPORAL_NAMESPACE;

    // 3. Construct Path
    const path = `/namespaces/${namespace}/workflows`;
    const fullUrl = `${baseUrl}${path}`;

    window.open(fullUrl, "_blank", "noopener,noreferrer");
  };

  const onConnect = useCallback(
    (params: Connection) => {
      takeSnapshot();
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            style: { stroke: "#9333ea", strokeWidth: 2 },
          },
          eds
        )
      );
    },
    [setEdges, takeSnapshot]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (!reactFlowWrapper.current) return;

      const dataString = event.dataTransfer.getData("application/reactflow");
      if (!dataString) return;

      const { type, label } = JSON.parse(dataString);

      const position = screenToFlowPosition({
        x: event.clientX - 120,
        y: event.clientY - 40,
      });

      //DEFINE DEFAULTS BASED ON TYPE
      let defaultConfig = {};

      if (type === "make_http_call") {
        defaultConfig = { method: "GET", url: "", headers: "{}" };
      } else if (type === "logic_wait") {
        defaultConfig = { duration: "5s" };
      } else if (type === "send_sms_twilio") {
        defaultConfig = { to: "{{loopItem.mobile}}" };
      }

      const isRegistered = Object.keys(nodeTypes).includes(type);
      const flowNodeType = isRegistered ? type : "default";

      const newNode: Node = {
        id: `${type}_${Date.now()}`,
        type: flowNodeType,
        position,
        data: { label, type, config: defaultConfig, status: "idle" },
      };

      takeSnapshot();
      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes, reactFlowWrapper, takeSnapshot, screenToFlowPosition]
  );

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    setIsPanelOpen(true);
  };

  const onConfigChange = (key: string, value: unknown) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === selectedNodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              config: { ...(typeof node.data.config === "object" && node.data.config !== null ? node.data.config : {}), [key]: value },
            },
          };
        }
        return node;
      })
    );
  };

  const syncAllModels = (modelName: string) => {
    takeSnapshot();
    setNodes((nds) =>
      nds.map((node) => {
        if (node.type === "ai_agent" || node.type === "tool_generic_llm" || node.type === "agent_researcher") {
          return {
            ...node,
            data: {
              ...node.data,
              config: {
                ...(typeof node.data.config === "object" && node.data.config !== null ? node.data.config : {}),
                model: modelName
              },
            },
          };
        }
        return node;
      })
    );
    alert(`Successfully applied ${modelName} to all AI blocks!`);
  };

  // --- 4. UPDATED DEPLOY LOGIC ---
  const onDeploy = async () => {
    setIsDeploying(true);

    // Reset statuses visual state
    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, status: "pending" } }))
    );

    try {
      const startNode = nodes.find((n) => n.type === "trigger_start");
      if (!startNode) throw new Error("Workflow must have a Start Trigger");

      // 🛑 Critical Check: If workflow has no ID, or is a sample/local (not a real DB UUID), save it first
      let currentId = id;
      let currentWorkflowId = workflowId;

      if (!currentId || !isUUID(currentId) || !currentWorkflowId || currentWorkflowId.startsWith('sample_')) {
        console.log("Workflow not in database or is template. Saving to database first...");
        const savedWorkflow = await performSaveToDatabase();
        if (!savedWorkflow) return; // Save failed
        currentId = savedWorkflow.id;
        currentWorkflowId = savedWorkflow.workflowId;
      }

      // Initialize Steps Dictionary
      interface WorkflowStep {
        id: string;
        name: string;
        type: string;
        params: Record<string, unknown>;
        next: string | null;
        branches: Record<string, string>;
      }
      const steps: Record<string, WorkflowStep> = {};

      nodes.forEach((node) => {
        steps[node.id] = {
          id: node.id,
          name: node.data.label as string,
          type: node.data.type as string,
          params: (node.data.config as Record<string, unknown>) || {},
          next: null, // Default linear path
          branches: {}, // Map for Router/Condition paths (HandleID -> NodeID)
        };
      });

      // Map Edges to 'next' or 'branches'
      edges.forEach((edge) => {
        const sourceStep = steps[edge.source];

        // Safety check
        if (!sourceStep) return;

        if (sourceStep.type === "logic_parallel") {
          // If the handle is "next" (bottom handle), it's the Fan-In path
          if (edge.sourceHandle === "next") {
            sourceStep.next = edge.target;
          }
          // Otherwise, it's a specific branch (Right handles)
          else if (edge.sourceHandle) {
            sourceStep.branches[edge.sourceHandle] = edge.target;
          }
        }

        // CASE B: Router Node (Everything is a branch/path)
        else if (sourceStep.type === "logic_router") {
          if (edge.sourceHandle === "default") {
            sourceStep.branches["default"] = edge.target;
          } else if (edge.sourceHandle) {
            sourceStep.branches[edge.sourceHandle] = edge.target;
          }
        }

        // CASE C: Loop Node (Body vs Done)
        else if (sourceStep.type === "logic_loop") {
          if (edge.sourceHandle === "body")
            sourceStep.branches["body"] = edge.target;
          if (edge.sourceHandle === "done")
            sourceStep.branches["done"] = edge.target;
        }

        // CASE D: Standard Linear Nodes
        else {
          sourceStep.next = edge.target;
        }
      });

      const payload = {
        id: currentId,
        workflowId: currentWorkflowId, // Use the (possibly newly saved) ID
        userId: getAuthUser()?.id, // 👈 PASS USER ID FOR CREDITS
        startAt: startNode.id,
        steps: steps,
      };

      console.log("Sending Payload:", JSON.stringify(payload, null, 2));

      const response = await fetch("/api/workflows/deploy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const detail =
          (Array.isArray(errBody?.message) ? errBody.message.join(', ') : errBody?.message) ||
          response.statusText;
        throw new Error(`Server Error: ${detail}`);
      }


      const result = await response.json();
      console.log(`deploy_result: ${JSON.stringify(result)}`);

      if (result.workflowId || result.runId) {
        const runId = result.runId;
        setRunId(runId);
        console.log(`Workflow deployed: ${result.workflowId}, runId: ${runId}`);
      } else {
        alert("Workflow deployed but no ID returned");
      }
    } catch (error: unknown) {
      console.error(error);
      alert(`❌ Deployment Failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsDeploying(false);
    }
  };

  const onRunWorkflow = async () => {
    if (!workflowId) return;
    setIsRunning(true);
    try {
      const response = await fetch(`/api/webhooks/${workflowId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "manual_ui_trigger",
          userId: getAuthUser()?.id, // 👈 PASS USER ID FOR CREDITS
          userEmail: getAuthUser()?.email // 👈 PASS EMAIL FOR COMPOSIO ROUTING

        }),
      });

      if (!response.ok) throw new Error("Failed to start workflow");
      const result = await response.json();
      setRunId(result.runId);
      alert("🚀 Workflow started!");
    } catch (error) {
      console.error(error);
      alert("❌ Failed to start workflow");
    } finally {
      setIsRunning(false);
    }
  };

  /**
   * Helper that performs the actual fetch to save.
   * Returns the parsed response if successful, null otherwise.
   */
  const performSaveToDatabase = async () => {
    try {
      const response = await fetch("/api/workflows", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          name: workflowName,
          nodes,
          edges,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save: ${response.statusText}`);
      }

      const resp = await response.json();
      // Sync State
      setId(resp.id);
      setWorkflowId(resp.workflowId);
      return resp;
    } catch (e) {
      console.error(e);
      alert("❌ Failed to save to database");
      return null;
    }
  };

  const onSaveDatabase = async () => {
    const result = await performSaveToDatabase();
    if (result) {
      alert("✅ Workflow Saved to Database!");
      setShowSaveModal(false);
    }
  };

  const onSaveLocal = async () => {
    try {
      const response = await fetch("/api/workflows/export-local", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          name: workflowName,
          nodes,
          edges,
        }),
      });

      if (response.ok) {
        const resp = await response.json();
        alert(`✅ Locally saved to: ${resp.path}`);
        setShowSaveModal(false);
      } else {
        alert("❌ Failed to export locally");
      }
    } catch {
      alert("❌ Failed to export locally");
    }
  };

  // --- LOAD FUNCTION ---
  const onLoadWorkflow = (workflowData: Record<string, unknown>) => {
    console.log("Loading workflow (appending):", workflowData);

    const incomingNodes = (workflowData.nodes as Node[]) || [];
    const incomingEdges = (workflowData.edges as Edge[]) || [];

    const idMap = new Map<string, string>();
    const newNodes = incomingNodes.map((node, index) => {
      const newId = `${node.type || 'node'}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      idMap.set(node?.id || newId, newId);

      const safeData = node?.data || {};

      return {
        ...node,
        id: newId,
        type: node?.type || "default",
        position: {
          x: node?.position?.x ?? (150 + index * 260),
          y: node?.position?.y ?? (100 + index * 80)
        },
        selected: true,
        data: {
          label: safeData.label || node?.type || "New Node",
          type: safeData.type || node?.type || "default",
          config: safeData.config || {},
          status: safeData.status || "idle",
        }
      };
    });

    const newEdges = incomingEdges.map((edge) => {
      const source = idMap.get(edge.source) || edge.source;
      const target = idMap.get(edge.target) || edge.target;
      return {
        ...edge,
        id: `e_${source}_${target}`,
        source,
        target,
        // AI sometimes injects phantom handles that break standard node routing
        sourceHandle: edge.sourceHandle?.includes('default') ? null : edge.sourceHandle,
        targetHandle: edge.targetHandle?.includes('default') ? null : edge.targetHandle,
        selected: true,
      };
    });

    // 1. Append Nodes and Edges
    takeSnapshot();
    setNodes((nds) => nds.map((n) => ({ ...n, selected: false } as Node)).concat(newNodes));
    setEdges((eds) => eds.map((e) => ({ ...e, selected: false } as Edge)).concat(newEdges));

    setWorkflowName((workflowData.name as string) || "Untitled Workflow");

    // Check if it's a "real" database workflow
    const incomingId = String(workflowData.id || "");

    if (isUUID(incomingId)) {
      setId(incomingId);
      setWorkflowId(workflowData.workflowId as string);
    } else {
      // It's a template or local file - treat as NEW
      setId("");
      setWorkflowId("");
    }

    // 2. Close modal
    setShowSavedList(false);
  };

  const onExportConfig = () => {
    const data = { nodes, edges, name: workflowName, workflowId };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflowName.replace(/\s+/g, '_')}_config.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        onLoadWorkflow(data);
      } catch {
        alert("Failed to parse the configuration file.");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  return (
    <div className="h-screen w-full flex flex-col font-sans transition-colors duration-300 bg-white dark:bg-black text-gray-900 dark:text-white overflow-hidden">
      {/* HEADER */}
      <div className="h-16 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center px-6 justify-between z-20 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-purple-500/30">
              <Zap size={20} fill="currentColor" />
            </div>
            <span className="font-bold text-xl tracking-tight text-gray-800 dark:text-white hidden sm:inline">
              Agent Workflow
            </span>
          </div>
          <div className="hidden lg:block">
            <SystemStatus />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>

          <button
            onClick={cycleTheme}
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-all border border-transparent dark:border-gray-700 w-9 h-9 flex items-center justify-center"
            title={`Toggle Theme (Current: ${theme})`}
          >
            {theme === 'light' ? <Sun size={18} /> : theme === 'dark' ? <Moon size={18} /> : <Monitor size={18} />}
          </button>

          {/* LOAD BUTTON */}
          <button
            onClick={() => setShowSavedList(!showSavedList)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-2 text-sm font-medium"
          >
            <FolderOpen size={18} />
            <span className="hidden sm:inline">Load</span>
          </button>

          {/* SAVE BUTTON */}
          <button
            onClick={() => setShowSaveModal(true)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-2 text-sm font-medium"
          >
            <Save size={18} />
            <span className="hidden sm:inline">Save</span>
          </button>

          {/* EXPORT BUTTON */}
          <button
            onClick={onExportConfig}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-2 text-sm font-medium"
            title="Export workflow config to JSON"
          >
            <Download size={18} />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* IMPORT BUTTON */}
          <label className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-2 text-sm font-medium cursor-pointer mr-2">
            <Upload size={18} />
            <span className="hidden sm:inline">Import</span>
            <input type="file" accept=".json" className="hidden" onChange={onImportConfig} />
          </label>

          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={onDeploy}
              disabled={isDeploying}
              className="bg-purple-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-purple-700 shadow-md transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isDeploying ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <Zap size={16} fill="currentColor" />
                  Deploy Workflow
                </>
              )}
            </button>

            {/* RUN BUTTON - Only show if we have a workflowId (published) */}
            {workflowId && !isDeploying && (
              <button
                onClick={onRunWorkflow}
                disabled={isRunning}
                className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 shadow-md transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isRunning ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Activity size={16} />
                    Run Workflow
                  </>
                )}
              </button>
            )}
          </div>

          <button
            onClick={openTemporalHistory}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
              text-gray-600 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100
            `}
            title="View Execution History in Temporal"
          >
            <Activity size={18} />
            <span className="hidden sm:inline">Monitor Runs</span>
            <ExternalLink size={12} className="opacity-20" />
          </button>

          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>

          <button
            onClick={() => setShowAgentsPage(true)}
            className="p-2 ml-1 rounded-full bg-purple-50 text-purple-600 hover:bg-purple-100 dark:bg-purple-500/20 dark:text-purple-400 dark:hover:bg-purple-500/30 transition-colors shadow-sm"
            title="Agents"
          >
            <Bot size={18} />
          </button>

          {/* Credit Balance Badge */}
          {creditBalance !== null && (
            <button
              onClick={() => setShowProfileModal(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm ${creditBalance <= 5
                ? 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30 animate-pulse'
                : creditBalance <= 10
                  ? 'bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/30'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30'
                }`}
              title="Click to manage credits"
            >
              <Coins size={12} />
              {creditBalance} credits
            </button>
          )}

          <button
            onClick={() => setShowProfileModal(true)}
            className="p-2 ml-1 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-500/20 dark:text-indigo-400 dark:hover:bg-indigo-500/30 transition-colors shadow-sm"
            title="Profile & Settings"
          >
            <UserIcon size={18} />
          </button>
        </div>
      </div>

      {/* WORKSPACE */}
      <div className="flex flex-1 overflow-hidden" ref={reactFlowWrapper}>
        <div
          className={`
            transition-all duration-300 ease-in-out border-r border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900
            ${isSidebarOpen ? "w-72" : "w-20"} 
          `}
        >
          <Sidebar
            isCollapsed={!isSidebarOpen}
            onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
            onOpenMarketplace={() => setShowMarketplace(true)}
          />
        </div>

        {/* CANVAS */}
        <div className="flex-1 h-full bg-gray-50 dark:bg-black/90 relative transition-colors duration-300 min-w-0">
          {showSavedList && (
            <SavedWorkflowsList
              onLoad={onLoadWorkflow}
              onClose={() => setShowSavedList(false)}
            />
          )}

          <McpMarketplace
            isOpen={showMarketplace}
            onClose={() => setShowMarketplace(false)}
          />

          {showTutorialOverlay && <TutorialOverlay onClose={() => {
            handleTutorialClose();
            const user = getAuthUser();
            if (user && !user.phone_number) setShowPhonePrompt(true);
          }} />}

          {showPhonePrompt && <PhoneEnrollmentPrompt
            onClose={() => setShowPhonePrompt(false)}
            onSuccess={() => setShowPhonePrompt(false)}
          />}

          {showProfileModal && <ProfileModal
            onClose={() => setShowProfileModal(false)}
            onOpenPhonePrompt={() => setShowPhonePrompt(true)}
            theme={theme}
            onThemeChange={setTheme}
          />}

          {/* Workflow Helper — floating panel */}
          <WorkflowHelperPanel onLoadWorkflow={onLoadWorkflow} />

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onNodeDragStart={takeSnapshot}
            onNodesDelete={takeSnapshot}
            onEdgesDelete={takeSnapshot}
            nodeTypes={nodeTypes}
            deleteKeyCode={['Backspace', 'Delete']}
            fitView
            minZoom={0.1}
          >
            <Background
              gap={24}
              size={1.5}
              color={isDarkMode ? "#444" : "#cbd5e1"}
            />
            <Controls className="dark:bg-gray-800 dark:border-gray-700 dark:fill-white shadow-xl bg-white fill-gray-900" />
          </ReactFlow>

          {/* SAVE MODAL */}
          {showSaveModal && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-2xl w-96 transform transition-all border border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">Save Workspace</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Workspace Name
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none"
                      value={workflowName}
                      onChange={(e) => setWorkflowName(e.target.value)}
                      placeholder="e.g. My Custom Workflow"
                      autoFocus
                    />
                  </div>

                  <div className="flex flex-col gap-2 pt-2">
                    <button
                      onClick={onSaveDatabase}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors font-medium"
                    >
                      <Save size={16} /> Save to Database
                    </button>

                    <button
                      onClick={onSaveLocal}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-gray-800 hover:bg-black dark:bg-gray-700 dark:hover:bg-gray-600 text-white rounded transition-colors font-medium"
                    >
                      <Download size={16} /> Save Local Workspace
                    </button>

                    <button
                      onClick={() => setShowSaveModal(false)}
                      className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-900 dark:hover:bg-black text-gray-700 dark:text-gray-300 rounded transition-colors mt-2"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div
          className={`
            transition-all duration-300 ease-in-out border-l border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900
            ${isPanelOpen ? "w-96 opacity-100" : "w-0 opacity-0 border-l-0"}
           `}
        >
          <div className="w-96 h-full">
            <DynamicPropertyPanel
              selectedNode={selectedNode || null}
              onChange={onConfigChange}
              onSyncAllModels={syncAllModels}
              onClose={() => setIsPanelOpen(false)}
            />
          </div>
        </div>
      </div>

      {/* Agents Page — full-screen overlay */}
      {showAgentsPage && (
        <AgentsPage onBack={() => setShowAgentsPage(false)} />
      )}
    </div>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const user = getAuthUser();
  if (!isAuthenticated() || !user?.is_admin) {
    return <Navigate to="/app" replace />;
  }
  return <>{children}</>;
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/totp-setup" element={<TotpSetup />} />
        <Route path="/tutorial" element={<TutorialPage />} />
        <Route path="/admin-bootstrap" element={
          <ProtectedRoute>
            <AdminBootstrap />
          </ProtectedRoute>
        } />
        <Route path="/admin/users" element={
          <AdminRoute>
            <AdminUsersPage />
          </AdminRoute>
        } />
        <Route path="/app" element={
          <ProtectedRoute>
            <ReactFlowProvider>
              <AppContent />
            </ReactFlowProvider>
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
