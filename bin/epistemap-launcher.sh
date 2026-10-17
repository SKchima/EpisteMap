#!/usr/bin/env bash
# EpisteMap Desktop Launcher for Rofi, Hyprland & Desktop Environments
# Garante ciclo de vida 1-a-1 entre janela do aplicativo e servidor local.

set -e

# Garante que ferramentas administrativas de portas e processos estejam no PATH
export PATH="/sbin:/usr/sbin:/usr/local/sbin:${PATH}"

SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(dirname "${SCRIPT_PATH}")"
REPO_DIR="$(dirname "${SCRIPT_DIR}")"
PORT=5173
HOST="127.0.0.1"
URL="http://${HOST}:${PORT}"
STATE_DIR="${HOME}/.local/state/epistemap"
PID_FILE="${STATE_DIR}/server.pid"
LOG_FILE="${STATE_DIR}/server.log"
CHROME_PROFILE="${STATE_DIR}/chrome-profile"
CHROME_BIN="/usr/bin/google-chrome-stable"

mkdir -p "${STATE_DIR}" "${CHROME_PROFILE}"

is_server_running() {
    curl -s -f -o /dev/null "${URL}" 2>/dev/null
}

has_running_chrome() {
    pgrep -f "${CHROME_PROFILE}" >/dev/null 2>&1
}

ensure_build() {
    cd "${REPO_DIR}"
    local needs_build=0

    if [ ! -f "${REPO_DIR}/dist/index.html" ]; then
        needs_build=1
    else
        # Se algum arquivo em src/, public/, index.html, vite.config.ts ou package.json for mais recente que o dist, recompila
        local newer_files
        newer_files=$(find "${REPO_DIR}/src" "${REPO_DIR}/public" "${REPO_DIR}/index.html" "${REPO_DIR}/vite.config.ts" "${REPO_DIR}/package.json" -newer "${REPO_DIR}/dist/index.html" 2>/dev/null || true)
        if [ -n "${newer_files}" ]; then
            needs_build=1
        fi
    fi

    if [ "${needs_build}" -eq 1 ]; then
        echo "Compilando pacote de produção otimizado do EpisteMap..."
        npm run build > "${STATE_DIR}/build.log" 2>&1 || {
            echo "Erro na compilação do pacote. Verifique ${STATE_DIR}/build.log."
            return 1
        }
    fi
}

start_server() {
    local mode="${1:-preview}"
    cd "${REPO_DIR}"

    if is_server_running; then
        echo "EpisteMap server já está em execução em ${URL}."
        return 0
    fi

    # Limpa processos mortos ou portas presas anteriores
    if [ -f "${PID_FILE}" ]; then
        local old_pid
        old_pid=$(cat "${PID_FILE}" 2>/dev/null || true)
        if [ -n "${old_pid}" ] && kill -0 "${old_pid}" 2>/dev/null; then
            kill -9 "${old_pid}" 2>/dev/null || true
        fi
        rm -f "${PID_FILE}"
    fi
    fuser -k "${PORT}/tcp" 2>/dev/null || true

    local node_bin
    node_bin=$(which node || echo "/usr/bin/node")
    local vite_bin="${REPO_DIR}/node_modules/vite/bin/vite.js"

    local server_cmd
    if [ "${mode}" = "dev" ]; then
        echo "Iniciando servidor de desenvolvimento com HMR..."
        server_cmd=("${node_bin}" "${vite_bin}" --port "${PORT}" --host "${HOST}" --strictPort)
    else
        ensure_build
        echo "Iniciando servidor de produção EpisteMap..."
        server_cmd=("${node_bin}" "${vite_bin}" preview --port "${PORT}" --host "${HOST}" --strictPort)
    fi

    # Vincula o ciclo de vida do Node ao processo pai via PR_SET_PDEATHSIG=SIGTERM (Linux)
    # Se o launcher morrer abruptamente (kill -9, encerramento de sessão, etc.),
    # o kernel automaticamente envia SIGTERM ao servidor Node, garantindo zero processos órfãos.
    if command -v python3 >/dev/null 2>&1; then
        python3 -c "import ctypes, os, sys; ctypes.CDLL(None).prctl(1, 15); os.execv(sys.argv[1], sys.argv[1:])" \
            "${server_cmd[@]}" < /dev/null > "${LOG_FILE}" 2>&1 &
        echo $! > "${PID_FILE}"
    else
        "${server_cmd[@]}" < /dev/null > "${LOG_FILE}" 2>&1 &
        echo $! > "${PID_FILE}"
    fi

    # Aguarda o servidor responder na porta
    local max_retries=40
    local count=0
    while ! is_server_running; do
        sleep 0.15
        count=$((count + 1))
        if [ $count -ge $max_retries ]; then
            echo "Erro: O servidor não respondeu em ${URL}. Verifique ${LOG_FILE}."
            stop_server
            exit 1
        fi
    done
    echo "Servidor EpisteMap ativo em ${URL}."
}

stop_server() {
    echo "Encerrando servidor EpisteMap..."
    if [ -f "${PID_FILE}" ]; then
        local pid
        pid=$(cat "${PID_FILE}" 2>/dev/null || true)
        if [ -n "${pid}" ] && kill -0 "${pid}" 2>/dev/null; then
            kill "${pid}" 2>/dev/null || true
            local wait_count=0
            while kill -0 "${pid}" 2>/dev/null && [ $wait_count -lt 10 ]; do
                sleep 0.1
                wait_count=$((wait_count + 1))
            done
            if kill -0 "${pid}" 2>/dev/null; then
                kill -9 "${pid}" 2>/dev/null || true
            fi
        fi
        rm -f "${PID_FILE}"
    fi

    # Garante liberação absoluta da porta
    fuser -k "${PORT}/tcp" 2>/dev/null || true
    # Encerra processos residuais do perfil Chrome do EpisteMap
    pkill -f "${CHROME_PROFILE}" 2>/dev/null || true
    echo "Servidor EpisteMap parado."
}

status_server() {
    if is_server_running; then
        echo "EpisteMap rodando em ${URL}."
        if [ -f "${PID_FILE}" ]; then
            echo "PID: $(cat "${PID_FILE}")"
        fi
    else
        echo "EpisteMap não está rodando."
    fi
}

run_app() {
    local mode="${1:-preview}"
    shift || true

    local chrome_args=(
        "--user-data-dir=${CHROME_PROFILE}"
        "--app=${URL}"
        "--class=epistemap"
        "--no-first-run"
        "--no-default-browser-check"
        "--password-store=basic"
        "--disable-background-mode"
        "--disable-background-networking"
        "--disable-sync"
        "--disable-features=Vulkan"
        "--disable-vulkan-surface"
    )

    # Se estiver em sessão Wayland (Hyprland, Sway, etc.), aplica flags nativas do Ozone
    if [ -n "${WAYLAND_DISPLAY:-}" ] || [ "${XDG_SESSION_TYPE:-}" = "wayland" ]; then
        chrome_args+=(
            "--enable-features=UseOzonePlatform"
            "--ozone-platform=wayland"
        )
    else
        chrome_args+=(
            "--ozone-platform-hint=auto"
        )
    fi

    # Caso a aplicação já esteja rodando com janela aberta, traz para o foco e sai
    # sem disparar cleanup nem matar o servidor da instância ativa
    if is_server_running && has_running_chrome; then
        echo "EpisteMap já está em execução. Trazendo janela existente para primeiro plano..."
        if [ -x "${CHROME_BIN}" ]; then
            "${CHROME_BIN}" "${chrome_args[@]}" "$@" >/dev/null 2>&1 &
        fi
        exit 0
    fi

    # Limpa processos de perfil residuais caso o servidor não esteja ativo
    if ! is_server_running; then
        pkill -f "${CHROME_PROFILE}" 2>/dev/null || true
    fi

    # Inicia o servidor
    start_server "${mode}"

    echo "Abrindo EpisteMap..."
    local client_pid=""

    cleanup() {
        local exit_code=$?
        trap - EXIT INT TERM HUP
        if [ -n "${client_pid}" ] && kill -0 "${client_pid}" 2>/dev/null; then
            kill "${client_pid}" 2>/dev/null || true
        fi
        stop_server
        exit "${exit_code}"
    }
    trap cleanup EXIT INT TERM HUP

    if [ -x "${CHROME_BIN}" ]; then
        "${CHROME_BIN}" "${chrome_args[@]}" "$@" &
        client_pid=$!
        wait "${client_pid}" 2>/dev/null || true
    else
        echo "Aviso: Google Chrome não encontrado em ${CHROME_BIN}. Abrindo navegador padrão..."
        xdg-open "${URL}"
        echo "Pressione Ctrl+C para encerrar o servidor..."
        wait
    fi
}

install_desktop() {
    local bin_dir="${HOME}/.local/bin"
    local app_dir="${HOME}/.local/share/applications"
    mkdir -p "${bin_dir}" "${app_dir}"

    ln -sf "${SCRIPT_PATH}" "${bin_dir}/epistemap"
    echo "✓ Criado link simbólico em ${bin_dir}/epistemap"

    cat <<EOF > "${app_dir}/epistemap.desktop"
[Desktop Entry]
Version=1.0
Type=Application
Name=EpisteMap
GenericName=Knowledge Graph & Concept Mapper
Comment=Mapeamento e Modelagem de Conhecimento Científico
Exec=${bin_dir}/epistemap
Icon=${REPO_DIR}/public/icon.png
Terminal=false
Categories=Education;Science;Office;Development;
StartupWMClass=chrome-127.0.0.1__-Default
Keywords=knowledge;graph;concept;map;mindmap;math;science;latex;epistemology;
Actions=StopServer;DevMode;

[Desktop Action StopServer]
Name=Parar Servidor de Fundo
Exec=${bin_dir}/epistemap stop

[Desktop Action DevMode]
Name=Abrir em Modo Desenvolvimento
Exec=${bin_dir}/epistemap dev
EOF
    chmod +x "${app_dir}/epistemap.desktop"
    echo "✓ Instalado lançador desktop em ${app_dir}/epistemap.desktop"

    cat <<EOF > "${app_dir}/epistemap-dev.desktop"
[Desktop Entry]
Version=1.0
Type=Application
Name=EpisteMap (Dev)
GenericName=Knowledge Graph & Concept Mapper (Modo Desenvolvimento)
Comment=EpisteMap em Modo Desenvolvimento com Hot Module Reloading (HMR)
Exec=${bin_dir}/epistemap dev
Icon=${REPO_DIR}/public/icon.png
Terminal=false
Categories=Development;Education;Science;
StartupWMClass=chrome-127.0.0.1__-Default
Keywords=knowledge;graph;dev;vite;hmr;concept;map;mindmap;math;science;latex;epistemology;
Actions=StopServer;

[Desktop Action StopServer]
Name=Parar Servidor de Fundo
Exec=${bin_dir}/epistemap stop
EOF
    chmod +x "${app_dir}/epistemap-dev.desktop"
    echo "✓ Instalado lançador desktop de desenvolvimento em ${app_dir}/epistemap-dev.desktop"

    if command -v update-desktop-database >/dev/null 2>&1; then
        update-desktop-database "${app_dir}" 2>/dev/null || true
    fi
    echo "✓ EpisteMap e EpisteMap (Dev) agora estão disponíveis no seu Rofi / lançador de aplicativos!"
}

uninstall_desktop() {
    local bin_dir="${HOME}/.local/bin"
    local app_dir="${HOME}/.local/share/applications"
    rm -f "${bin_dir}/epistemap"
    rm -f "${app_dir}/epistemap.desktop"
    rm -f "${app_dir}/epistemap-dev.desktop"
    if command -v update-desktop-database >/dev/null 2>&1; then
        update-desktop-database "${app_dir}" 2>/dev/null || true
    fi
    echo "✓ EpisteMap e EpisteMap (Dev) desinstalados com sucesso de ${bin_dir} e ${app_dir}."
}

case "${1:-}" in
    install)
        install_desktop
        exit 0
        ;;
    uninstall)
        uninstall_desktop
        exit 0
        ;;
    stop)
        stop_server
        exit 0
        ;;
    status)
        status_server
        exit 0
        ;;
    start)
        # Inicia apenas o servidor em background (sem abrir janela)
        start_server "preview"
        exit 0
        ;;
    dev)
        shift || true
        run_app "dev" "$@"
        exit 0
        ;;
    *)
        run_app "preview" "$@"
        exit 0
        ;;
esac
